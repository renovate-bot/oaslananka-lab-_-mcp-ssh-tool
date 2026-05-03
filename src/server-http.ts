import { randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync } from "node:fs";
import { URL } from "node:url";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { isBearerAuthorizationValid } from "./auth.js";
import { createContainer } from "./container.js";
import { SERVER_VERSION, SSHMCPServer } from "./mcp.js";
import { logger } from "./logging.js";
import { initTelemetry, shutdownTelemetry, withSpan } from "./telemetry.js";

type HttpTransport = StreamableHTTPServerTransport | SSEServerTransport;

interface HttpSession {
  server: SSHMCPServer;
  transport: HttpTransport;
}

const endpoint = "/mcp";
const legacySseEndpoint = "/sse";
const legacyMessageEndpoint = "/messages";
const container = createContainer();
const httpConfig = container.config.get("http");
const sessions = new Map<string, HttpSession>();
const bearerToken = httpConfig.bearerTokenFile
  ? readFileSync(httpConfig.bearerTokenFile, "utf8").trim()
  : undefined;

initTelemetry({ serviceVersion: SERVER_VERSION });

function isLoopbackHost(host: string): boolean {
  return host === "127.0.0.1" || host === "localhost" || host === "::1";
}

function validateStartupConfig(): void {
  if (httpConfig.bearerTokenFile && bearerToken?.length === 0) {
    throw new Error("Refusing HTTP MCP startup with an empty bearer token file");
  }

  if (isLoopbackHost(httpConfig.host)) {
    return;
  }

  if (!bearerToken || httpConfig.allowedOrigins.length === 0) {
    throw new Error(
      "Refusing non-loopback HTTP MCP binding without SSH_MCP_HTTP_BEARER_TOKEN_FILE and SSH_MCP_HTTP_ALLOWED_ORIGINS",
    );
  }
}

function sendJson(res: ServerResponse, statusCode: number, payload: Record<string, unknown>) {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload, null, 2));
}

function rejectIfUnauthorized(req: IncomingMessage, res: ServerResponse): boolean {
  const origin = req.headers.origin;
  if (
    origin &&
    httpConfig.allowedOrigins.length > 0 &&
    !httpConfig.allowedOrigins.includes(origin)
  ) {
    sendJson(res, 403, { error: "Origin is not allowed" });
    return true;
  }

  if (!bearerToken) {
    return false;
  }

  if (!isBearerAuthorizationValid(req.headers.authorization, bearerToken)) {
    sendJson(res, 401, { error: "Missing or invalid bearer token" });
    return true;
  }

  return false;
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return undefined;
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : undefined;
}

async function handleStreamableRequest(
  req: IncomingMessage,
  res: ServerResponse,
  parsedBody?: unknown,
): Promise<void> {
  await withSpan(
    "http.streamable.request",
    async (span) => {
      const sessionHeader = req.headers["mcp-session-id"];
      const sessionId = Array.isArray(sessionHeader) ? sessionHeader[0] : sessionHeader;
      let session = sessionId ? sessions.get(sessionId) : undefined;

      span.setAttribute("http.route", endpoint);
      span.setAttribute("http.method", req.method ?? "UNKNOWN");
      if (sessionId) {
        span.setAttribute("mcp.session.id", sessionId);
      }

      if (!session && req.method === "POST" && isInitializeRequest(parsedBody)) {
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (newSessionId) => {
            sessions.set(newSessionId, { server, transport });
            logger.info("Streamable HTTP MCP session initialized", { sessionId: newSessionId });
          },
        });
        const server = new SSHMCPServer(container);
        transport.onclose = () => {
          const closedSessionId = transport.sessionId;
          if (closedSessionId) {
            sessions.delete(closedSessionId);
            logger.info("Streamable HTTP MCP session closed", { sessionId: closedSessionId });
          }
        };
        transport.onerror = (error) => {
          logger.error("Streamable HTTP MCP transport error", { error: error.message });
        };
        await server.connect(transport as Transport);
        session = { server, transport };
      }

      if (!session) {
        sendJson(res, 400, {
          jsonrpc: "2.0",
          error: {
            code: -32000,
            message: "Bad Request: initialize with POST /mcp or provide a valid MCP-Session-Id",
          },
          id: null,
        });
        return;
      }

      if (!(session.transport instanceof StreamableHTTPServerTransport)) {
        sendJson(res, 400, {
          error: "Session exists but uses a different transport protocol",
        });
        return;
      }

      await session.transport.handleRequest(req, res, parsedBody);
    },
    {
      attributes: {
        "http.route": endpoint,
        "http.method": req.method ?? "UNKNOWN",
      },
    },
  );
}

async function handleLegacySseConnection(
  _req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const transport = new SSEServerTransport(legacyMessageEndpoint, res);
  const sessionId = transport.sessionId;
  const server = new SSHMCPServer(container);

  transport.onclose = () => {
    sessions.delete(sessionId);
    logger.info("Legacy HTTP/SSE MCP session closed", { sessionId });
  };
  sessions.set(sessionId, { server, transport });
  await server.connect(transport);
  logger.warn("Legacy HTTP/SSE MCP session established", { sessionId });
}

async function handleLegacyMessage(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const baseUrl = `http://${req.headers.host ?? "localhost"}`;
  const requestUrl = new URL(req.url ?? legacyMessageEndpoint, baseUrl);
  const sessionId = requestUrl.searchParams.get("sessionId");
  if (!sessionId) {
    sendJson(res, 400, { error: "Missing sessionId query parameter" });
    return;
  }

  const session = sessions.get(sessionId);
  if (!session || !(session.transport instanceof SSEServerTransport)) {
    sendJson(res, 404, { error: "Legacy SSE session not found" });
    return;
  }

  await session.transport.handlePostMessage(req, res);
}

validateStartupConfig();

const httpServer = createServer((req, res) => {
  void (async () => {
    try {
      const requestUrl = new URL(req.url ?? endpoint, "http://localhost");

      if (requestUrl.pathname === "/.well-known/openai-apps-challenge") {
        res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("cxYvVGiJrMx7VjCg1z8KmodNB6dR7RyPLWpW7Lcy2Kg");
        return;
      }

      if (rejectIfUnauthorized(req, res)) {
        return;
      }

      if (requestUrl.pathname === endpoint) {
        if (req.method !== "GET" && req.method !== "POST" && req.method !== "DELETE") {
          sendJson(res, 405, { error: "Method not allowed" });
          return;
        }

        const parsedBody = req.method === "POST" ? await readJsonBody(req) : undefined;
        await handleStreamableRequest(req, res, parsedBody);
        return;
      }

      if (httpConfig.enableLegacySse && requestUrl.pathname === legacySseEndpoint) {
        if (req.method !== "GET") {
          sendJson(res, 405, { error: "Method not allowed" });
          return;
        }
        await handleLegacySseConnection(req, res);
        return;
      }

      if (httpConfig.enableLegacySse && requestUrl.pathname === legacyMessageEndpoint) {
        if (req.method !== "POST") {
          sendJson(res, 405, { error: "Method not allowed" });
          return;
        }
        await handleLegacyMessage(req, res);
        return;
      }

      sendJson(res, 404, { error: "Not found" });
    } catch (error) {
      logger.error("HTTP MCP request failed", { error });
      if (!res.headersSent) {
        sendJson(res, 500, { error: "Internal server error" });
      }
    }
  })();
});

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) {
    process.exit(0);
  }

  shuttingDown = true;
  logger.info(`Received ${signal}, shutting down HTTP MCP server...`);

  httpServer.close();

  await Promise.all(
    Array.from(sessions.entries()).map(async ([sessionId, session]) => {
      try {
        await session.transport.close();
      } catch (error) {
        logger.warn("Failed to close HTTP MCP transport cleanly", { sessionId, error });
      }
    }),
  );
  sessions.clear();

  container.rateLimiter.destroy();
  await container.sessionManager.destroy();
  await shutdownTelemetry();
  process.exit(0);
}

httpServer.listen(httpConfig.port, httpConfig.host, () => {
  logger.info("Streamable HTTP MCP server listening", {
    host: httpConfig.host,
    port: httpConfig.port,
    endpoint,
    legacySse: httpConfig.enableLegacySse,
  });
});

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

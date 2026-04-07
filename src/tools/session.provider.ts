import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { logger } from "../logging.js";
import type { MetricsCollector } from "../metrics.js";
import type { SessionManager } from "../session.js";
import { getConfiguredHosts, resolveSSHHost } from "../ssh-config.js";
import { ConnectionParamsSchema, HostAliasSchema, SessionIdSchema } from "../types.js";
import type { ToolProvider } from "./types.js";

export interface SessionToolProviderDeps {
  sessionManager: SessionManager;
  metrics: MetricsCollector;
}

export class SessionToolProvider implements ToolProvider {
  readonly namespace = "session";

  constructor(private readonly deps: SessionToolProviderDeps) {}

  getTools(): Tool[] {
    return [
      {
        name: "ssh_open_session",
        description: "Opens a new SSH session with authentication",
        inputSchema: {
          type: "object" as const,
          properties: {
            host: { type: "string", description: "SSH server hostname or IP" },
            username: { type: "string", description: "SSH username" },
            port: { type: "number", description: "SSH port (default: 22)" },
            auth: {
              type: "string",
              enum: ["auto", "password", "key", "agent"],
              description: "Authentication method (default: auto)",
            },
            password: {
              type: "string",
              description: "Password for authentication",
            },
            privateKey: {
              type: "string",
              description: "Inline private key content",
            },
            privateKeyPath: {
              type: "string",
              description: "Path to private key file",
            },
            passphrase: {
              type: "string",
              description: "Passphrase for encrypted private key",
            },
            useAgent: {
              type: "boolean",
              description: "Use SSH agent for authentication",
            },
            readyTimeoutMs: {
              type: "number",
              description: "Connection timeout in milliseconds (default: 20000)",
            },
            ttlMs: {
              type: "number",
              description: "Session TTL in milliseconds (default: 900000)",
            },
            strictHostKeyChecking: {
              type: "boolean",
              description: "Enable strict SSH host key checking",
            },
            knownHostsPath: {
              type: "string",
              description: "Path to known_hosts file",
            },
          },
          required: ["host", "username"],
        },
      },
      {
        name: "ssh_close_session",
        description: "Closes an SSH session",
        inputSchema: {
          type: "object" as const,
          properties: {
            sessionId: { type: "string", description: "Session ID to close" },
          },
          required: ["sessionId"],
        },
      },
      {
        name: "ssh_list_sessions",
        description: "Lists all active SSH sessions with their details",
        inputSchema: {
          type: "object" as const,
          properties: {},
          required: [],
        },
      },
      {
        name: "ssh_ping",
        description: "Checks if an SSH session is still alive and responsive",
        inputSchema: {
          type: "object" as const,
          properties: {
            sessionId: {
              type: "string",
              description: "SSH session ID to check",
            },
          },
          required: ["sessionId"],
        },
      },
      {
        name: "ssh_list_configured_hosts",
        description: "Lists all hosts configured in ~/.ssh/config",
        inputSchema: {
          type: "object" as const,
          properties: {},
          required: [],
        },
      },
      {
        name: "ssh_resolve_host",
        description: "Resolves a host alias from ~/.ssh/config to connection parameters",
        inputSchema: {
          type: "object" as const,
          properties: {
            hostAlias: {
              type: "string",
              description: "Host alias from SSH config",
            },
          },
          required: ["hostAlias"],
        },
      },
    ];
  }

  handleTool(toolName: string, args: unknown): Promise<unknown> | undefined {
    switch (toolName) {
      case "ssh_open_session":
        return this.openSession(args);
      case "ssh_close_session":
        return this.closeSession(args);
      case "ssh_list_sessions":
        return this.listSessions();
      case "ssh_ping":
        return this.ping(args);
      case "ssh_list_configured_hosts":
        return this.listConfiguredHosts();
      case "ssh_resolve_host":
        return this.resolveHost(args);
      default:
        return undefined;
    }
  }

  private async openSession(args: unknown): Promise<unknown> {
    const params = ConnectionParamsSchema.parse(args);
    const result = await this.deps.sessionManager.openSession(
      this.normalizeConnectionParams(params),
    );
    this.deps.metrics.recordSessionCreated();
    logger.info("SSH session opened", {
      sessionId: result.sessionId,
      host: params.host,
    });
    return result;
  }

  private async closeSession(args: unknown): Promise<boolean> {
    const { sessionId } = SessionIdSchema.parse(args);
    const result = await this.deps.sessionManager.closeSession(sessionId);
    if (result) {
      this.deps.metrics.recordSessionClosed();
    }
    logger.info("SSH session closed", { sessionId });
    return result;
  }

  private async listSessions(): Promise<unknown> {
    const sessions = this.deps.sessionManager.getActiveSessions();
    logger.info("Sessions listed", { count: sessions.length });
    return {
      count: sessions.length,
      sessions: sessions.map((session) => ({
        sessionId: session.sessionId,
        host: session.host,
        username: session.username,
        port: session.port,
        createdAt: new Date(session.createdAt).toISOString(),
        expiresAt: new Date(session.expiresAt).toISOString(),
        lastUsed: new Date(session.lastUsed).toISOString(),
        remainingMs: Math.max(0, session.expiresAt - Date.now()),
      })),
    };
  }

  private async ping(args: unknown): Promise<unknown> {
    const { sessionId } = SessionIdSchema.parse(args);
    const session = this.deps.sessionManager.getSession(sessionId);
    if (!session) {
      return { alive: false, error: "Session not found or expired" };
    }

    try {
      const startTime = Date.now();
      const pingResult = await session.ssh.execCommand("echo pong");
      const latencyMs = Date.now() - startTime;
      const result = {
        alive: (pingResult.code ?? 0) === 0,
        latencyMs,
        sessionId,
        host: session.info.host,
        remainingMs: Math.max(0, session.info.expiresAt - Date.now()),
      };

      logger.info("Session ping", {
        sessionId,
        alive: result.alive,
        latencyMs,
      });
      return result;
    } catch {
      return { alive: false, error: "Connection test failed" };
    }
  }

  private async listConfiguredHosts(): Promise<unknown> {
    const hosts = await getConfiguredHosts();
    logger.info("Configured hosts listed", { count: hosts.length });
    return { count: hosts.length, hosts };
  }

  private async resolveHost(args: unknown): Promise<unknown> {
    const { hostAlias } = HostAliasSchema.parse(args);
    const resolved = await resolveSSHHost(hostAlias);
    logger.info("Host resolved", { hostAlias, resolved: resolved.host });
    return resolved;
  }

  private normalizeConnectionParams(params: {
    host: string;
    username: string;
    auth: "auto" | "password" | "key" | "agent";
    readyTimeoutMs: number;
    ttlMs: number;
    strictHostKeyChecking: boolean;
    port?: number | undefined;
    password?: string | undefined;
    privateKey?: string | undefined;
    privateKeyPath?: string | undefined;
    passphrase?: string | undefined;
    useAgent?: boolean | undefined;
    knownHostsPath?: string | undefined;
  }) {
    return {
      host: params.host,
      username: params.username,
      auth: params.auth,
      readyTimeoutMs: params.readyTimeoutMs,
      ttlMs: params.ttlMs,
      strictHostKeyChecking: params.strictHostKeyChecking,
      ...(params.port !== undefined ? { port: params.port } : {}),
      ...(params.password ? { password: params.password } : {}),
      ...(params.privateKey ? { privateKey: params.privateKey } : {}),
      ...(params.privateKeyPath ? { privateKeyPath: params.privateKeyPath } : {}),
      ...(params.passphrase ? { passphrase: params.passphrase } : {}),
      ...(params.useAgent !== undefined ? { useAgent: params.useAgent } : {}),
      ...(params.knownHostsPath ? { knownHostsPath: params.knownHostsPath } : {}),
    };
  }
}

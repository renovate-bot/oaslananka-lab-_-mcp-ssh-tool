import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { AppContainer } from "./container.js";
import { logger } from "./logging.js";
import { listResources, readResource } from "./resources.js";
import { withSpan } from "./telemetry.js";
import { createToolRegistry } from "./tools/index.js";

export const SERVER_VERSION = "1.3.5";

export class SSHMCPServer {
  private readonly server: Server;
  private readonly registry: ReturnType<typeof createToolRegistry>;

  constructor(private readonly container: AppContainer) {
    this.server = new Server(
      {
        name: "ssh-mcp-server",
        version: SERVER_VERSION,
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      },
    );
    this.registry = createToolRegistry(container);

    this.setupHandlers();
    this.setupErrorHandling();
  }

  private setupHandlers(): void {
    this.server.setRequestHandler(ListResourcesRequestSchema, async () =>
      withSpan(
        "mcp.list_resources",
        async (span) => {
          span.setAttribute("mcp.request.kind", "list_resources");
          return listResources();
        },
        {
          attributes: {
            "mcp.request.kind": "list_resources",
          },
        },
      ),
    );

    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) =>
      withSpan(
        "mcp.read_resource",
        async (span) => {
          span.setAttribute("mcp.request.kind", "read_resource");
          span.setAttribute("mcp.resource.uri", request.params.uri);
          return readResource(request.params.uri, this.container);
        },
        {
          attributes: {
            "mcp.request.kind": "read_resource",
            "mcp.resource.uri": request.params.uri,
          },
        },
      ),
    );

    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: this.registry.getAllTools(),
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) =>
      withSpan(
        "mcp.call_tool",
        async (span) => {
          const { name, arguments: args } = request.params;

          span.setAttribute("mcp.request.kind", "call_tool");
          span.setAttribute("mcp.tool.name", name);

          if (this.container.config.get("rateLimit").enabled) {
            const rateCheck = this.container.rateLimiter.check("global");
            if (!rateCheck.allowed) {
              span.setAttribute("mcp.rate_limited", true);
              return {
                content: [
                  {
                    type: "text" as const,
                    text: JSON.stringify(
                      {
                        error: true,
                        code: "ERATELIMIT",
                        message: `Rate limit exceeded for tool: ${name}`,
                        resetIn: rateCheck.resetIn,
                      },
                      null,
                      2,
                    ),
                  },
                ],
                isError: true,
              };
            }
          }

          span.setAttribute("mcp.rate_limited", false);
          return this.registry.dispatch(name, args ?? {});
        },
        {
          attributes: {
            "mcp.request.kind": "call_tool",
            "mcp.tool.name": request.params.name,
          },
        },
      ),
    );
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      logger.error("Server error", {
        error: error instanceof Error ? error.message : String(error),
      });
    };
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.connect(transport);
  }

  async connect(transport: Transport): Promise<void> {
    await this.server.connect(transport);
    logger.info("SSH MCP Server started successfully");
  }
}

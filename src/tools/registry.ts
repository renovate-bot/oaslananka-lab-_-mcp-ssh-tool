import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { logger } from "../logging.js";
import type { ToolCallResult, ToolProvider } from "./types.js";

const TOOL_ALIASES: Record<string, string> = {
  "ssh.openSession": "ssh_open_session",
  "ssh.closeSession": "ssh_close_session",
  "proc.exec": "proc_exec",
  "proc.sudo": "proc_sudo",
  "fs.read": "fs_read",
  "fs.write": "fs_write",
  "fs.stat": "fs_stat",
  "fs.list": "fs_list",
  "fs.mkdirp": "fs_mkdirp",
  "fs.rmrf": "fs_rmrf",
  "fs.rename": "fs_rename",
  "ensure.package": "ensure_package",
  "ensure.service": "ensure_service",
  "ensure.linesInFile": "ensure_lines_in_file",
  "patch.apply": "patch_apply",
  "os.detect": "os_detect",
  "ssh.listSessions": "ssh_list_sessions",
  "ssh.ping": "ssh_ping",
  "ssh.listConfiguredHosts": "ssh_list_configured_hosts",
  "ssh.resolveHost": "ssh_resolve_host",
};

export class ToolRegistry {
  private readonly providers = new Map<string, ToolProvider>();

  register(provider: ToolProvider): this {
    if (this.providers.has(provider.namespace)) {
      throw new Error(`ToolRegistry: namespace "${provider.namespace}" is already registered`);
    }

    this.providers.set(provider.namespace, provider);
    logger.debug("ToolRegistry: registered provider", {
      namespace: provider.namespace,
    });
    return this;
  }

  getAllTools(): Tool[] {
    const tools: Tool[] = [];
    for (const provider of this.providers.values()) {
      tools.push(...provider.getTools());
    }
    return tools;
  }

  async dispatch(rawToolName: string, args: unknown): Promise<ToolCallResult> {
    const toolName = TOOL_ALIASES[rawToolName] ?? rawToolName;

    for (const provider of this.providers.values()) {
      const result = provider.handleTool(toolName, args);
      if (result === undefined) {
        continue;
      }

      try {
        const data = await result;
        const text = typeof data === "string" ? data : JSON.stringify(data, null, 2);
        return {
          content: [{ type: "text", text }],
        };
      } catch (error) {
        logger.error("Tool handler error", { toolName, error });

        if (
          error &&
          typeof error === "object" &&
          "toJSON" in error &&
          typeof error.toJSON === "function"
        ) {
          const structuredError = error.toJSON() as Record<string, unknown>;
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ error: true, ...structuredError }, null, 2),
              },
            ],
            isError: true,
          };
        }

        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ error: true, message }, null, 2),
            },
          ],
          isError: true,
        };
      }
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ error: true, message: `Unknown tool: ${toolName}` }, null, 2),
        },
      ],
      isError: true,
    };
  }
}

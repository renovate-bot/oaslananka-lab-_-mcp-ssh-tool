import { getConfiguredHosts } from "./ssh-config.js";
import type { AppContainer } from "./container.js";

export interface MCPResource {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

const RESOURCE_DEFINITIONS: readonly MCPResource[] = [
  {
    uri: "mcp-ssh-tool://sessions/active",
    name: "Active SSH sessions",
    description: "Current in-memory SSH sessions tracked by the session manager",
    mimeType: "application/json",
  },
  {
    uri: "mcp-ssh-tool://metrics/json",
    name: "Metrics snapshot",
    description: "Current runtime metrics in JSON format",
    mimeType: "application/json",
  },
  {
    uri: "mcp-ssh-tool://metrics/prometheus",
    name: "Prometheus metrics",
    description: "Prometheus-formatted metrics export",
    mimeType: "text/plain",
  },
  {
    uri: "mcp-ssh-tool://ssh-config/hosts",
    name: "Configured SSH hosts",
    description: "Parsed host aliases from the local ~/.ssh/config cache",
    mimeType: "application/json",
  },
] as const;

export function listResources(): { resources: MCPResource[] } {
  return {
    resources: RESOURCE_DEFINITIONS.map((resource) => ({ ...resource })),
  };
}

export async function readResource(
  uri: string,
  container: AppContainer,
): Promise<{
  contents: Array<{
    uri: string;
    mimeType: string;
    text: string;
  }>;
}> {
  switch (uri) {
    case "mcp-ssh-tool://sessions/active":
      return jsonResource(uri, "application/json", container.sessionManager.getActiveSessions());
    case "mcp-ssh-tool://metrics/json":
      return jsonResource(uri, "application/json", container.metrics.getMetrics());
    case "mcp-ssh-tool://metrics/prometheus":
      return textResource(uri, "text/plain", container.metrics.exportPrometheus());
    case "mcp-ssh-tool://ssh-config/hosts":
      return jsonResource(uri, "application/json", {
        hosts: await getConfiguredHosts(),
      });
    default:
      throw new Error(`Unknown resource: ${uri}`);
  }
}

function jsonResource(
  uri: string,
  mimeType: string,
  value: unknown,
): {
  contents: Array<{
    uri: string;
    mimeType: string;
    text: string;
  }>;
} {
  return textResource(uri, mimeType, JSON.stringify(value, null, 2));
}

function textResource(
  uri: string,
  mimeType: string,
  text: string,
): {
  contents: Array<{
    uri: string;
    mimeType: string;
    text: string;
  }>;
} {
  return {
    contents: [
      {
        uri,
        mimeType,
        text,
      },
    ],
  };
}

import { isRemoteSafeToolProfile, type ToolProfile } from "./connector-profile.js";
import type { HostKeyPolicy } from "./types.js";

export interface HttpStartupConfig {
  host: string;
  allowedOrigins: string[];
  bearerTokenFile?: string;
}

export interface HttpStartupSecurityContext {
  toolProfile: ToolProfile;
  allowedHosts: string[];
  hostKeyPolicy?: HostKeyPolicy;
  authMode?: "bearer" | "oauth";
  oauthConfigured?: boolean;
}

export function isLoopbackHost(host: string): boolean {
  return host === "127.0.0.1" || host === "localhost" || host === "::1";
}

export function validateHttpStartupConfig(
  httpConfig: HttpStartupConfig,
  bearerToken: string | undefined,
  context: HttpStartupSecurityContext = {
    toolProfile: "full",
    allowedHosts: [],
    hostKeyPolicy: "strict",
    authMode: "bearer",
    oauthConfigured: false,
  },
): void {
  if (httpConfig.bearerTokenFile && bearerToken?.length === 0) {
    throw new Error("Refusing HTTP MCP startup with an empty bearer token file");
  }

  if (isLoopbackHost(httpConfig.host)) {
    return;
  }

  const hasBearerAuth = Boolean(bearerToken);
  const hasOAuthAuth = context.authMode === "oauth" && context.oauthConfigured === true;
  if ((!hasBearerAuth && !hasOAuthAuth) || httpConfig.allowedOrigins.length === 0) {
    throw new Error(
      "Refusing non-loopback HTTP MCP binding without SSH_MCP_HTTP_BEARER_TOKEN_FILE or OAuth config, and SSH_MCP_HTTP_ALLOWED_ORIGINS",
    );
  }

  if (!isRemoteSafeToolProfile(context.toolProfile)) {
    throw new Error(
      "Refusing non-loopback HTTP MCP binding with full tool profile. Set SSH_MCP_TOOL_PROFILE=remote-safe, chatgpt, claude, remote-readonly, or remote-broker.",
    );
  }

  if (context.allowedHosts.length === 0) {
    throw new Error(
      "Refusing non-loopback HTTP MCP binding without SSH_MCP_ALLOWED_HOSTS for remote connector profile",
    );
  }

  if ((context.hostKeyPolicy ?? "strict") !== "strict") {
    throw new Error(
      "Refusing non-loopback HTTP MCP binding without strict SSH host-key verification",
    );
  }
}

export function isOriginAllowed(origin: string | undefined, allowedOrigins: string[]): boolean {
  return !origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin);
}

export function corsHeaders(
  origin: string | undefined,
  allowedOrigins: string[],
): Record<string, string> {
  if (!origin || !isOriginAllowed(origin, allowedOrigins)) {
    return {};
  }

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, content-type, mcp-session-id",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Expose-Headers": "mcp-session-id",
    Vary: "Origin",
  };
}

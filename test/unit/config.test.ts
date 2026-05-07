import { afterEach, describe, expect, test } from "@jest/globals";
import { ConfigManager } from "../../src/config.js";

describe("ConfigManager", () => {
  afterEach(() => {
    delete process.env.SSH_MCP_MAX_SESSIONS;
    delete process.env.SSH_MCP_SESSION_TTL;
    delete process.env.SSH_MCP_COMMAND_TIMEOUT;
    delete process.env.SSH_MCP_DEBUG;
    delete process.env.SSH_MCP_RATE_LIMIT;
    delete process.env.SSH_MCP_STRICT_HOST_KEY;
    delete process.env.STRICT_HOST_KEY_CHECKING;
    delete process.env.SSH_MCP_HOST_KEY_POLICY;
    delete process.env.SSH_MCP_MAX_FILE_SIZE;
    delete process.env.SSH_MCP_ALLOW_RAW_SUDO;
    delete process.env.SSH_MCP_COMMAND_DENY;
    delete process.env.SSH_MCP_LOCAL_PATH_ALLOW_PREFIXES;
    delete process.env.SSH_MCP_LOCAL_PATH_DENY_PREFIXES;
    delete process.env.SSH_MCP_HTTP_HOST;
    delete process.env.SSH_MCP_HTTP_PORT;
    delete process.env.SSH_MCP_TOOL_PROFILE;
    delete process.env.SSH_MCP_CONNECTOR_PROFILE;
    delete process.env.SSH_MCP_CONNECTOR_CREDENTIAL_PROVIDER;
    delete process.env.SSH_MCP_CONNECTOR_CREDENTIAL_COMMAND;
    delete process.env.SSH_MCP_CONNECTOR_CREDENTIAL_COMMAND_ARGS;
    delete process.env.SSH_MCP_CONNECTOR_CREDENTIAL_COMMAND_TIMEOUT_MS;
    delete process.env.SSH_MCP_CONNECTOR_DEFAULT_USERNAME;
    delete process.env.SSH_MCP_HTTP_AUTH_MODE;
    delete process.env.SSH_MCP_OAUTH_ISSUER;
    delete process.env.SSH_MCP_OAUTH_AUDIENCE;
    delete process.env.SSH_MCP_OAUTH_JWKS_URL;
    delete process.env.SSH_MCP_OAUTH_RESOURCE;
    delete process.env.SSH_MCP_OAUTH_REQUIRED_SCOPES;
  });

  test("uses default values", () => {
    const config = new ConfigManager();

    expect(config.get("maxSessions")).toBe(20);
    expect(config.get("debug")).toBe(false);
    expect(config.get("rateLimit").enabled).toBe(true);
    expect(config.get("security").hostKeyPolicy).toBe("strict");
    expect(config.get("security").allowRootLogin).toBe(false);
    expect(config.get("policy").allowRawSudo).toBe(false);
    expect(config.get("policy").localPathAllowPrefixes?.length).toBeGreaterThan(0);
    expect(config.get("http").host).toBe("127.0.0.1");
    expect(config.get("connector").toolProfile).toBe("full");
    expect(config.get("connector").credentialProvider).toBe("none");
    expect(config.get("auth").mode).toBe("bearer");
  });

  test("reads environment overrides", () => {
    process.env.SSH_MCP_MAX_SESSIONS = "42";
    process.env.SSH_MCP_SESSION_TTL = "5000";
    process.env.SSH_MCP_COMMAND_TIMEOUT = "7000";
    process.env.SSH_MCP_DEBUG = "true";
    process.env.SSH_MCP_RATE_LIMIT = "false";
    process.env.SSH_MCP_STRICT_HOST_KEY = "true";
    process.env.SSH_MCP_MAX_FILE_SIZE = "1024";
    process.env.SSH_MCP_ALLOW_RAW_SUDO = "true";
    process.env.SSH_MCP_COMMAND_DENY = "rm -rf,shutdown";
    process.env.SSH_MCP_LOCAL_PATH_ALLOW_PREFIXES = "/tmp/local,/var/tmp/local";
    process.env.SSH_MCP_LOCAL_PATH_DENY_PREFIXES = "/tmp/local/secret";
    process.env.SSH_MCP_HTTP_HOST = "localhost";
    process.env.SSH_MCP_HTTP_PORT = "4444";
    process.env.SSH_MCP_TOOL_PROFILE = "remote-readonly";
    process.env.SSH_MCP_CONNECTOR_CREDENTIAL_PROVIDER = "agent";
    process.env.SSH_MCP_CONNECTOR_CREDENTIAL_COMMAND_ARGS = "resolver.mjs,--json";
    process.env.SSH_MCP_CONNECTOR_DEFAULT_USERNAME = "deploy";
    process.env.SSH_MCP_HTTP_AUTH_MODE = "oauth";
    process.env.SSH_MCP_OAUTH_ISSUER = "https://auth.example";
    process.env.SSH_MCP_OAUTH_AUDIENCE = "https://mcp.example/mcp";
    process.env.SSH_MCP_OAUTH_JWKS_URL = "https://auth.example/.well-known/jwks.json";
    process.env.SSH_MCP_OAUTH_REQUIRED_SCOPES = "mcp-ssh-tool.read,mcp-ssh-tool.plan";

    const config = new ConfigManager();

    expect(config.get("maxSessions")).toBe(42);
    expect(config.get("sessionTtlMs")).toBe(5000);
    expect(config.get("commandTimeoutMs")).toBe(7000);
    expect(config.get("maxFileSize")).toBe(1024);
    expect(config.get("debug")).toBe(true);
    expect(config.get("rateLimit").enabled).toBe(false);
    expect(config.get("security").hostKeyPolicy).toBe("strict");
    expect(config.get("policy").allowRawSudo).toBe(true);
    expect(config.get("policy").commandDeny).toEqual(["rm -rf", "shutdown"]);
    expect(config.get("policy").localPathAllowPrefixes).toEqual(["/tmp/local", "/var/tmp/local"]);
    expect(config.get("policy").localPathDenyPrefixes).toEqual(["/tmp/local/secret"]);
    expect(config.get("http").host).toBe("localhost");
    expect(config.get("http").port).toBe(4444);
    expect(config.get("connector").toolProfile).toBe("remote-readonly");
    expect(config.get("connector").credentialProvider).toBe("agent");
    expect(config.get("connector").credentialCommandArgs).toEqual(["resolver.mjs", "--json"]);
    expect(config.get("connector").defaultUsername).toBe("deploy");
    expect(config.get("auth")).toEqual(
      expect.objectContaining({
        mode: "oauth",
        oauthIssuer: "https://auth.example",
        oauthAudience: "https://mcp.example/mcp",
        oauthJwksUrl: "https://auth.example/.well-known/jwks.json",
        oauthRequiredScopes: ["mcp-ssh-tool.read", "mcp-ssh-tool.plan"],
      }),
    );
  });

  test("reads STRICT_HOST_KEY_CHECKING as the preferred host verification flag", () => {
    process.env.STRICT_HOST_KEY_CHECKING = "false";

    const config = new ConfigManager();

    expect(config.get("security").hostKeyPolicy).toBe("insecure");
  });

  test("hostKeyPolicy overrides deprecated strict host key aliases", () => {
    process.env.STRICT_HOST_KEY_CHECKING = "false";
    process.env.SSH_MCP_HOST_KEY_POLICY = "accept-new";

    const config = new ConfigManager();

    expect(config.get("security").hostKeyPolicy).toBe("accept-new");
  });

  test("programmatic overrides take precedence and merge nested values", () => {
    process.env.SSH_MCP_MAX_SESSIONS = "5";

    const config = new ConfigManager({
      maxSessions: 99,
      rateLimit: { enabled: true, maxRequests: 5, windowMs: 1000 },
      security: {
        allowedCiphers: ["aes256-gcm"],
        allowRootLogin: false,
        hostKeyPolicy: "strict",
        knownHostsPath: "/tmp/known_hosts",
      },
    });

    expect(config.get("maxSessions")).toBe(99);
    expect(config.get("rateLimit")).toEqual({
      enabled: true,
      maxRequests: 5,
      windowMs: 1000,
    });
    expect(config.get("security")).toEqual({
      allowRootLogin: false,
      hostKeyPolicy: "strict",
      knownHostsPath: "/tmp/known_hosts",
      allowedCiphers: ["aes256-gcm"],
    });
  });

  test("programmatic root-login security setting propagates to policy by default", () => {
    const config = new ConfigManager({
      security: {
        allowedCiphers: [],
        allowRootLogin: true,
        hostKeyPolicy: "strict",
        knownHostsPath: "/tmp/known_hosts",
      },
    });

    expect(config.get("security").allowRootLogin).toBe(true);
    expect(config.get("policy").allowRootLogin).toBe(true);
  });

  test("getAll returns frozen copies", () => {
    const config = new ConfigManager();
    const all = config.getAll();

    expect(Object.isFrozen(all)).toBe(true);
    expect(Object.isFrozen(all.rateLimit)).toBe(true);
    expect(Object.isFrozen(all.security)).toBe(true);
    expect(all).not.toBe(config.getAll());
  });

  test("update changes runtime values", () => {
    const config = new ConfigManager();
    config.update({
      debug: true,
      rateLimit: { enabled: false, maxRequests: 25, windowMs: 5000 },
    });

    expect(config.get("debug")).toBe(true);
    expect(config.get("rateLimit")).toEqual({
      enabled: false,
      maxRequests: 25,
      windowMs: 5000,
    });
  });
});

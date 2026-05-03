import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { logger } from "./logging.js";
import type { PolicyConfig } from "./policy.js";
import type { HostKeyPolicy } from "./types.js";

/**
 * Server configuration options
 */
export interface ServerConfig {
  /** Maximum concurrent sessions */
  maxSessions: number;
  /** Default session TTL in milliseconds */
  sessionTtlMs: number;
  /** Session cleanup interval in milliseconds */
  cleanupIntervalMs: number;
  /** Default command timeout in milliseconds */
  commandTimeoutMs: number;
  /** Maximum file size for read operations (bytes) */
  maxFileSize: number;
  /** Enable debug logging */
  debug: boolean;
  /** Rate limiting configuration */
  rateLimit: {
    enabled: boolean;
    maxRequests: number;
    windowMs: number;
  };
  /** Security settings */
  security: {
    allowRootLogin: boolean;
    hostKeyPolicy: HostKeyPolicy;
    knownHostsPath: string;
    allowedCiphers: string[];
  };
  /** Policy settings enforced before risky operations */
  policy: PolicyConfig;
  /** Remote HTTP transport settings */
  http: {
    host: string;
    port: number;
    allowedOrigins: string[];
    bearerTokenFile?: string;
    enableLegacySse: boolean;
  };
}

export const DEFAULT_CONFIG: ServerConfig = {
  maxSessions: 20,
  sessionTtlMs: 900000, // 15 minutes
  cleanupIntervalMs: 10000, // 10 seconds
  commandTimeoutMs: 30000, // 30 seconds
  maxFileSize: 10 * 1024 * 1024, // 10MB
  debug: false,
  rateLimit: {
    enabled: true,
    maxRequests: 100,
    windowMs: 60000,
  },
  security: {
    allowRootLogin: false,
    hostKeyPolicy: "strict",
    knownHostsPath: path.join(os.homedir(), ".ssh", "known_hosts"),
    allowedCiphers: [],
  },
  policy: {
    mode: "enforce",
    allowRootLogin: false,
    allowRawSudo: false,
    allowDestructiveCommands: false,
    allowDestructiveFs: false,
    allowedHosts: [],
    commandAllow: [],
    commandDeny: [],
    pathAllowPrefixes: ["/tmp", "/var/tmp", "/home", "/Users"],
    pathDenyPrefixes: ["/etc/sudoers", "/etc/shadow", "/etc/passwd", "/boot", "/dev", "/proc"],
    localPathAllowPrefixes: [os.tmpdir()],
    localPathDenyPrefixes: [],
  },
  http: {
    host: "127.0.0.1",
    port: 3000,
    allowedOrigins: ["http://127.0.0.1", "http://localhost"],
    enableLegacySse: false,
  },
};

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback;
  }
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function parseInteger(value: string | undefined, fallback: number): number {
  if (value === undefined) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseList(value: string | undefined): string[] {
  if (!value) {
    return [];
  }
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseHostKeyPolicy(value: string | undefined, fallback: HostKeyPolicy): HostKeyPolicy {
  if (value === "strict" || value === "accept-new" || value === "insecure") {
    return value;
  }
  return fallback;
}

function loadPolicyFile(filePath: string | undefined): Partial<PolicyConfig> {
  if (!filePath) {
    return {};
  }

  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw) as Partial<PolicyConfig>;
  } catch (error) {
    logger.warn("Failed to load policy file; using environment/default policy", {
      filePath,
      error,
    });
    return {};
  }
}

/**
 * Configuration manager with environment variable overrides
 */
export class ConfigManager {
  private config: ServerConfig;

  constructor(overrides: Partial<ServerConfig> = {}) {
    this.config = this.loadConfig(overrides);
    logger.debug("Configuration loaded", { config: this.config });
  }

  private loadConfig(overrides: Partial<ServerConfig>): ServerConfig {
    // Start with defaults
    const config: ServerConfig = {
      ...DEFAULT_CONFIG,
      rateLimit: { ...DEFAULT_CONFIG.rateLimit },
      security: {
        ...DEFAULT_CONFIG.security,
        allowedCiphers: [...DEFAULT_CONFIG.security.allowedCiphers],
      },
    };

    // Apply environment variable overrides
    config.maxSessions = parseInteger(process.env.SSH_MCP_MAX_SESSIONS, config.maxSessions);
    config.sessionTtlMs = parseInteger(process.env.SSH_MCP_SESSION_TTL, config.sessionTtlMs);
    config.commandTimeoutMs = parseInteger(
      process.env.SSH_MCP_COMMAND_TIMEOUT,
      config.commandTimeoutMs,
    );
    config.maxFileSize = parseInteger(process.env.SSH_MCP_MAX_FILE_SIZE, config.maxFileSize);
    config.debug = parseBoolean(process.env.SSH_MCP_DEBUG, config.debug);
    config.rateLimit.enabled = parseBoolean(
      process.env.SSH_MCP_RATE_LIMIT,
      config.rateLimit.enabled,
    );
    config.rateLimit.maxRequests = parseInteger(
      process.env.SSH_MCP_RATE_LIMIT_MAX,
      config.rateLimit.maxRequests,
    );
    config.rateLimit.windowMs = parseInteger(
      process.env.SSH_MCP_RATE_LIMIT_WINDOW_MS,
      config.rateLimit.windowMs,
    );

    const strictHostKeyChecking =
      process.env.STRICT_HOST_KEY_CHECKING ?? process.env.SSH_MCP_STRICT_HOST_KEY;
    if (strictHostKeyChecking !== undefined) {
      config.security.hostKeyPolicy = parseBoolean(strictHostKeyChecking, true)
        ? "strict"
        : "insecure";
    }
    config.security.hostKeyPolicy = parseHostKeyPolicy(
      process.env.SSH_MCP_HOST_KEY_POLICY,
      config.security.hostKeyPolicy,
    );
    config.security.knownHostsPath =
      process.env.KNOWN_HOSTS_PATH ??
      process.env.SSH_MCP_KNOWN_HOSTS_PATH ??
      config.security.knownHostsPath;
    config.security.allowRootLogin = parseBoolean(
      process.env.SSH_MCP_ALLOW_ROOT_LOGIN,
      config.security.allowRootLogin,
    );
    config.security.allowedCiphers = parseList(process.env.SSH_MCP_ALLOWED_CIPHERS);

    const filePolicy = loadPolicyFile(process.env.SSH_MCP_POLICY_FILE);
    config.policy = {
      ...config.policy,
      ...filePolicy,
      mode:
        process.env.SSH_MCP_POLICY_MODE === "explain"
          ? "explain"
          : (filePolicy.mode ?? config.policy.mode),
      allowRootLogin: config.security.allowRootLogin,
      allowRawSudo: parseBoolean(
        process.env.SSH_MCP_ALLOW_RAW_SUDO,
        filePolicy.allowRawSudo ?? config.policy.allowRawSudo,
      ),
      allowDestructiveCommands: parseBoolean(
        process.env.SSH_MCP_ALLOW_DESTRUCTIVE_COMMANDS,
        filePolicy.allowDestructiveCommands ?? config.policy.allowDestructiveCommands,
      ),
      allowDestructiveFs: parseBoolean(
        process.env.SSH_MCP_ALLOW_DESTRUCTIVE_FS,
        filePolicy.allowDestructiveFs ?? config.policy.allowDestructiveFs,
      ),
      allowedHosts: parseList(process.env.SSH_MCP_ALLOWED_HOSTS).length
        ? parseList(process.env.SSH_MCP_ALLOWED_HOSTS)
        : (filePolicy.allowedHosts ?? config.policy.allowedHosts),
      commandAllow: parseList(process.env.SSH_MCP_COMMAND_ALLOW).length
        ? parseList(process.env.SSH_MCP_COMMAND_ALLOW)
        : (filePolicy.commandAllow ?? config.policy.commandAllow),
      commandDeny: parseList(process.env.SSH_MCP_COMMAND_DENY).length
        ? parseList(process.env.SSH_MCP_COMMAND_DENY)
        : (filePolicy.commandDeny ?? config.policy.commandDeny),
      pathAllowPrefixes: parseList(process.env.SSH_MCP_PATH_ALLOW_PREFIXES).length
        ? parseList(process.env.SSH_MCP_PATH_ALLOW_PREFIXES)
        : (filePolicy.pathAllowPrefixes ?? config.policy.pathAllowPrefixes),
      pathDenyPrefixes: parseList(process.env.SSH_MCP_PATH_DENY_PREFIXES).length
        ? parseList(process.env.SSH_MCP_PATH_DENY_PREFIXES)
        : (filePolicy.pathDenyPrefixes ?? config.policy.pathDenyPrefixes),
      localPathAllowPrefixes: parseList(process.env.SSH_MCP_LOCAL_PATH_ALLOW_PREFIXES).length
        ? parseList(process.env.SSH_MCP_LOCAL_PATH_ALLOW_PREFIXES)
        : (filePolicy.localPathAllowPrefixes ?? config.policy.localPathAllowPrefixes),
      localPathDenyPrefixes: parseList(process.env.SSH_MCP_LOCAL_PATH_DENY_PREFIXES).length
        ? parseList(process.env.SSH_MCP_LOCAL_PATH_DENY_PREFIXES)
        : (filePolicy.localPathDenyPrefixes ?? config.policy.localPathDenyPrefixes),
    };
    config.policy.allowRootLogin = config.security.allowRootLogin;

    const bearerTokenFile =
      process.env.SSH_MCP_HTTP_BEARER_TOKEN_FILE ?? config.http.bearerTokenFile;
    config.http = {
      ...config.http,
      host: process.env.SSH_MCP_HTTP_HOST ?? config.http.host,
      port: parseInteger(process.env.PORT ?? process.env.SSH_MCP_HTTP_PORT, config.http.port),
      allowedOrigins: parseList(process.env.SSH_MCP_HTTP_ALLOWED_ORIGINS).length
        ? parseList(process.env.SSH_MCP_HTTP_ALLOWED_ORIGINS)
        : config.http.allowedOrigins,
      ...(bearerTokenFile ? { bearerTokenFile } : {}),
      enableLegacySse: parseBoolean(
        process.env.SSH_MCP_ENABLE_LEGACY_SSE,
        config.http.enableLegacySse,
      ),
    };

    // Apply programmatic overrides last
    const security = {
      ...config.security,
      ...overrides.security,
      allowedCiphers: overrides.security?.allowedCiphers ?? [...config.security.allowedCiphers],
    };
    const policy = {
      ...config.policy,
      ...overrides.policy,
      allowRootLogin: overrides.policy?.allowRootLogin ?? security.allowRootLogin,
      allowedHosts: overrides.policy?.allowedHosts ?? [...config.policy.allowedHosts],
      commandAllow: overrides.policy?.commandAllow ?? [...config.policy.commandAllow],
      commandDeny: overrides.policy?.commandDeny ?? [...config.policy.commandDeny],
      pathAllowPrefixes: overrides.policy?.pathAllowPrefixes ?? [
        ...config.policy.pathAllowPrefixes,
      ],
      pathDenyPrefixes: overrides.policy?.pathDenyPrefixes ?? [...config.policy.pathDenyPrefixes],
      localPathAllowPrefixes: overrides.policy?.localPathAllowPrefixes ?? [
        ...(config.policy.localPathAllowPrefixes ?? []),
      ],
      localPathDenyPrefixes: overrides.policy?.localPathDenyPrefixes ?? [
        ...(config.policy.localPathDenyPrefixes ?? []),
      ],
    };

    return {
      ...config,
      ...overrides,
      rateLimit: {
        ...config.rateLimit,
        ...overrides.rateLimit,
      },
      security,
      policy,
      http: {
        ...config.http,
        ...overrides.http,
        allowedOrigins: overrides.http?.allowedOrigins ?? [...config.http.allowedOrigins],
      },
    };
  }

  /**
   * Get a configuration value
   */
  get<K extends keyof ServerConfig>(key: K): ServerConfig[K] {
    return this.config[key];
  }

  /**
   * Get the entire configuration
   */
  getAll(): Readonly<ServerConfig> {
    return Object.freeze({
      ...this.config,
      rateLimit: Object.freeze({ ...this.config.rateLimit }),
      security: Object.freeze({
        ...this.config.security,
        allowedCiphers: [...this.config.security.allowedCiphers],
      }),
      policy: Object.freeze({
        ...this.config.policy,
        allowedHosts: [...this.config.policy.allowedHosts],
        commandAllow: [...this.config.policy.commandAllow],
        commandDeny: [...this.config.policy.commandDeny],
        pathAllowPrefixes: [...this.config.policy.pathAllowPrefixes],
        pathDenyPrefixes: [...this.config.policy.pathDenyPrefixes],
        localPathAllowPrefixes: [...(this.config.policy.localPathAllowPrefixes ?? [])],
        localPathDenyPrefixes: [...(this.config.policy.localPathDenyPrefixes ?? [])],
      }),
      http: Object.freeze({
        ...this.config.http,
        allowedOrigins: [...this.config.http.allowedOrigins],
      }),
    });
  }

  /**
   * Update configuration at runtime
   */
  update(updates: Partial<ServerConfig>): void {
    const security = {
      ...this.config.security,
      ...updates.security,
      allowedCiphers: updates.security?.allowedCiphers ?? [...this.config.security.allowedCiphers],
    };
    const policy = {
      ...this.config.policy,
      ...updates.policy,
      allowRootLogin: updates.policy?.allowRootLogin ?? security.allowRootLogin,
      allowedHosts: updates.policy?.allowedHosts ?? [...this.config.policy.allowedHosts],
      commandAllow: updates.policy?.commandAllow ?? [...this.config.policy.commandAllow],
      commandDeny: updates.policy?.commandDeny ?? [...this.config.policy.commandDeny],
      pathAllowPrefixes: updates.policy?.pathAllowPrefixes ?? [
        ...this.config.policy.pathAllowPrefixes,
      ],
      pathDenyPrefixes: updates.policy?.pathDenyPrefixes ?? [
        ...this.config.policy.pathDenyPrefixes,
      ],
      localPathAllowPrefixes: updates.policy?.localPathAllowPrefixes ?? [
        ...(this.config.policy.localPathAllowPrefixes ?? []),
      ],
      localPathDenyPrefixes: updates.policy?.localPathDenyPrefixes ?? [
        ...(this.config.policy.localPathDenyPrefixes ?? []),
      ],
    };

    this.config = {
      ...this.config,
      ...updates,
      rateLimit: {
        ...this.config.rateLimit,
        ...updates.rateLimit,
      },
      security,
      policy,
      http: {
        ...this.config.http,
        ...updates.http,
        allowedOrigins: updates.http?.allowedOrigins ?? [...this.config.http.allowedOrigins],
      },
    };
    logger.info("Configuration updated", { updates });
  }
}

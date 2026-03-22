import { NodeSSH } from "node-ssh";
import type { SFTPWrapper } from "ssh2";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {
  ConnectionParams,
  SessionInfo,
  SessionResult,
  OSInfo,
} from "./types.js";
import {
  createAuthError,
  createConnectionError,
  createTimeoutError,
} from "./errors.js";
import { logger } from "./logging.js";
import { detectOS } from "./detect.js";

/**
 * SSH session with connection and optional SFTP client.
 * Some targets expose command execution but do not provide the SFTP subsystem.
 */
export interface SSHSession {
  ssh: NodeSSH;
  sftp?: SFTPWrapper;
  info: SessionInfo;
  connectionParams?: ConnectionParams; // For auto-reconnect
  osInfo?: OSInfo;
}

/**
 * Session manager with LRU cache and TTL
 */
export class SessionManager {
  private sessions = new Map<string, SSHSession>();
  private readonly maxSessions: number;
  private sessionCounter = 0;
  private cleanupInterval?: NodeJS.Timeout;
  private readonly CLEANUP_INTERVAL_MS = 10000; // 10 seconds

  constructor(maxSessions = 20) {
    this.maxSessions = maxSessions;

    // Clean up expired sessions every 10 seconds (was 60s, too slow)
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
    }, this.CLEANUP_INTERVAL_MS);
  }

  /**
   * Destroys the session manager, cleaning up all sessions and intervals
   */
  async destroy(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
    await this.closeAllSessions();
  }

  /**
   * Gets cached OS info for a session (detects and caches if needed)
   */
  async getOSInfo(sessionId: string): Promise<OSInfo> {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found or expired`);
    }

    if (session.osInfo) {
      return session.osInfo;
    }

    const osInfo = await detectOS(session.ssh);
    session.osInfo = osInfo;
    return osInfo;
  }

  /**
   * Opens a new SSH session with authentication
   */
  async openSession(params: ConnectionParams): Promise<SessionResult> {
    logger.debug("Opening SSH session", {
      host: params.host,
      username: params.username,
    });

    const sessionId = this.generateSessionId();
    const now = Date.now();
    const ttl = params.ttlMs || 900000; // 15 minutes default

    try {
      // Clean up old sessions if we're at the limit
      if (this.sessions.size >= this.maxSessions) {
        this.evictOldestSession();
      }

      const ssh = new NodeSSH();
      const authConfig = await this.buildAuthConfig(params);

      const strictHostKey =
        params.strictHostKeyChecking ??
        process.env.STRICT_HOST_KEY_CHECKING === "true";
      const knownHostsPath =
        params.knownHostsPath ?? process.env.KNOWN_HOSTS_PATH;

      const connectConfig = {
        host: params.host,
        username: params.username,
        port: params.port || 22,
        readyTimeout: params.readyTimeoutMs || 20000,
        hostVerifier: strictHostKey ? undefined : () => true,
        knownHosts: knownHostsPath,
        ...authConfig,
      };

      logger.debug("Connecting to SSH server");
      await ssh.connect(connectConfig);

      let sftp: SFTPWrapper | undefined;
      let sftpAvailable = false;
      try {
        sftp = await new Promise<SFTPWrapper>((resolve, reject) => {
          (ssh as any).connection.sftp(
            (err: Error | undefined, channel: SFTPWrapper) => {
              if (err) reject(err);
              else resolve(channel);
            },
          );
        });
        sftpAvailable = true;
      } catch (sftpError) {
        logger.warn("SFTP unavailable, continuing with SSH-only session", {
          host: params.host,
          username: params.username,
          error:
            sftpError instanceof Error ? sftpError.message : String(sftpError),
        });
      }

      if (!strictHostKey) {
        logger.warn(
          "Host key checking is DISABLED. Set STRICT_HOST_KEY_CHECKING=true for production use.",
          { sessionId },
        );
      }

      const sessionInfo: SessionInfo = {
        sessionId,
        host: params.host,
        username: params.username,
        port: params.port || 22,
        createdAt: now,
        expiresAt: now + ttl,
        lastUsed: now,
      };

      const session: SSHSession = {
        ssh,
        sftp,
        info: sessionInfo,
        connectionParams: params,
      };

      this.sessions.set(sessionId, session);

      logger.info("SSH session opened successfully", {
        sessionId,
        host: params.host,
        username: params.username,
        sftpAvailable,
        expiresInMs: ttl,
      });

      return {
        sessionId,
        host: params.host,
        username: params.username,
        sftpAvailable,
        expiresInMs: ttl,
      };
    } catch (error) {
      logger.error("Failed to open SSH session", { error, host: params.host });

      if (error instanceof Error) {
        if (error.message.includes("authentication")) {
          throw createAuthError(
            "SSH authentication failed",
            "Check your username, password, or SSH key configuration",
          );
        }
        if (
          error.message.includes("timeout") ||
          error.message.includes("ETIMEDOUT")
        ) {
          throw createTimeoutError(
            "SSH connection timeout",
            "Check if the host is reachable and the SSH service is running",
          );
        }
        if (error.message.includes("ECONNREFUSED")) {
          throw createConnectionError(
            "SSH connection refused",
            "Check if the SSH service is running on the target port",
          );
        }
      }

      throw createConnectionError(
        `Failed to establish SSH connection: ${error instanceof Error ? error.message : String(error)}`,
        "Verify the host, port, and network connectivity",
      );
    }
  }

  /**
   * Closes an SSH session
   */
  async closeSession(sessionId: string): Promise<boolean> {
    logger.debug("Closing SSH session", { sessionId });

    const session = this.sessions.get(sessionId);
    if (!session) {
      logger.warn("Session not found for closing", { sessionId });
      return false;
    }

    try {
      if (session.sftp && typeof (session.sftp as any).end === "function") {
        (session.sftp as any).end();
      }
      session.ssh.dispose();
    } catch (error) {
      logger.warn("Error closing session", { sessionId, error });
    }

    this.sessions.delete(sessionId);
    logger.info("SSH session closed", { sessionId });
    return true;
  }

  /**
   * Gets an active session by ID
   */
  getSession(sessionId: string): SSHSession | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return undefined;
    }

    if (Date.now() > session.info.expiresAt) {
      this.closeSession(sessionId);
      return undefined;
    }

    session.info.lastUsed = Date.now();
    return session;
  }

  /**
   * Builds authentication configuration based on the auth strategy
   */
  private async buildAuthConfig(params: ConnectionParams): Promise<any> {
    const authStrategy = params.auth || "auto";

    logger.debug("Building auth config", { strategy: authStrategy });

    switch (authStrategy) {
      case "password":
        if (!params.password) {
          throw createAuthError(
            "Password required for password authentication",
          );
        }
        return { password: params.password };
      case "key":
        return await this.buildKeyAuth(params);
      case "agent":
        return await this.buildAgentAuth();
      case "auto":
      default:
        return await this.buildAutoAuth(params);
    }
  }

  /**
   * Builds key-based authentication
   */
  private async buildKeyAuth(params: ConnectionParams): Promise<any> {
    if (params.privateKey) {
      logger.debug("Using inline private key");
      return {
        privateKey: params.privateKey,
        passphrase: params.passphrase,
      };
    }

    if (params.privateKeyPath) {
      logger.debug("Using private key from path", {
        path: params.privateKeyPath,
      });
      return await this.loadPrivateKeyFromPath(
        params.privateKeyPath,
        params.passphrase,
      );
    }

    return await this.discoverPrivateKeys(params.passphrase);
  }

  /**
   * Builds SSH agent authentication
   */
  private async buildAgentAuth(): Promise<any> {
    const authSock = process.env.SSH_AUTH_SOCK;
    if (!authSock) {
      throw createAuthError(
        "SSH agent not available",
        "Set SSH_AUTH_SOCK environment variable or use a different auth method",
      );
    }

    logger.debug("Using SSH agent authentication");
    return { agent: authSock };
  }

  /**
   * Builds automatic authentication (tries password, then key, then agent)
   */
  private async buildAutoAuth(params: ConnectionParams): Promise<any> {
    if (params.password) {
      logger.debug("Auto auth: trying password");
      return { password: params.password };
    }

    try {
      logger.debug("Auto auth: trying key authentication");
      return await this.buildKeyAuth(params);
    } catch {
      logger.debug("Auto auth: key authentication failed, trying agent");
    }

    try {
      return await this.buildAgentAuth();
    } catch {
      throw createAuthError(
        "No suitable authentication method found",
        "Provide a password, private key, or ensure SSH agent is running",
      );
    }
  }

  /**
   * Loads private key from file path
   */
  private async loadPrivateKeyFromPath(
    keyPath: string,
    passphrase?: string,
  ): Promise<any> {
    try {
      const privateKey = await fs.promises.readFile(keyPath, "utf8");
      return { privateKey, passphrase };
    } catch {
      throw createAuthError(
        `Failed to load private key from ${keyPath}`,
        "Check if the file exists and is readable",
      );
    }
  }

  /**
   * Auto-discovers private keys in standard locations
   */
  private async discoverPrivateKeys(passphrase?: string): Promise<any> {
    const homeDir = os.homedir();
    const keyDir =
      process.env.SSH_DEFAULT_KEY_DIR || path.join(homeDir, ".ssh");

    const keyFiles = ["id_ed25519", "id_rsa", "id_ecdsa"];

    for (const keyFile of keyFiles) {
      const keyPath = path.join(keyDir, keyFile);

      try {
        await fs.promises.access(keyPath, fs.constants.R_OK);
        logger.debug("Found SSH key", { path: keyPath });
        return await this.loadPrivateKeyFromPath(keyPath, passphrase);
      } catch {
        logger.debug("SSH key not found or not readable", { path: keyPath });
      }
    }

    throw createAuthError(
      "No SSH private keys found in standard locations",
      `Checked: ${keyFiles.map((f) => path.join(keyDir, f)).join(", ")}`,
    );
  }

  /**
   * Generates a unique session ID
   */
  private generateSessionId(): string {
    return `ssh-${Date.now()}-${++this.sessionCounter}`;
  }

  /**
   * Evicts the oldest (least recently used) session
   */
  private evictOldestSession(): void {
    let oldestSession: string | undefined;
    let oldestTime = Date.now();

    for (const [sessionId, session] of this.sessions) {
      if (session.info.lastUsed < oldestTime) {
        oldestTime = session.info.lastUsed;
        oldestSession = sessionId;
      }
    }

    if (oldestSession) {
      logger.info("Evicting oldest session", { sessionId: oldestSession });
      this.closeSession(oldestSession);
    }
  }

  /**
   * Cleans up expired sessions
   */
  private cleanupExpiredSessions(): void {
    const now = Date.now();
    const expiredSessions: string[] = [];

    for (const [sessionId, session] of this.sessions) {
      if (now > session.info.expiresAt) {
        expiredSessions.push(sessionId);
      }
    }

    for (const sessionId of expiredSessions) {
      logger.info("Cleaning up expired session", { sessionId });
      this.closeSession(sessionId);
    }
  }

  /**
   * Gets information about all active sessions
   */
  getActiveSessions(): SessionInfo[] {
    return Array.from(this.sessions.values()).map((session) => ({
      ...session.info,
    }));
  }

  /**
   * Closes all active sessions
   */
  async closeAllSessions(): Promise<void> {
    const sessionIds = Array.from(this.sessions.keys());
    await Promise.all(sessionIds.map((id) => this.closeSession(id)));
  }

  /**
   * Attempts to reconnect a session
   */
  async reconnectSession(sessionId: string): Promise<SessionResult | null> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      logger.warn("Session not found for reconnect", { sessionId });
      return null;
    }

    if (!session.connectionParams) {
      logger.warn("Session has no stored connection params", { sessionId });
      return null;
    }

    logger.info("Attempting to reconnect session", {
      sessionId,
      host: session.info.host,
    });

    await this.closeSession(sessionId);

    try {
      const result = await this.openSession(session.connectionParams);
      logger.info("Session reconnected successfully", {
        oldSessionId: sessionId,
        newSessionId: result.sessionId,
      });
      return result;
    } catch (error) {
      logger.error("Failed to reconnect session", { sessionId, error });
      throw error;
    }
  }

  /**
   * Checks if a session is alive by executing a simple command
   */
  async isSessionAlive(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    try {
      const result = await session.ssh.execCommand("echo 1");
      return result.code === 0;
    } catch (error) {
      logger.debug("Session health check failed", { sessionId, error });
      return false;
    }
  }

  /**
   * Gets session with auto-reconnect if disconnected
   */
  async getSessionWithReconnect(
    sessionId: string,
  ): Promise<SSHSession | undefined> {
    const session = this.getSession(sessionId);
    if (!session) {
      return undefined;
    }

    if (!(await this.isSessionAlive(sessionId))) {
      logger.info("Session disconnected, attempting reconnect", { sessionId });

      if (session.connectionParams) {
        try {
          await this.reconnectSession(sessionId);
          return undefined;
        } catch (error) {
          logger.error("Auto-reconnect failed", { sessionId, error });
          return undefined;
        }
      }
    }

    return session;
  }
}

// Global session manager instance
export const sessionManager = new SessionManager();

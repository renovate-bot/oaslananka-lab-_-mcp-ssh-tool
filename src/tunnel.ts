import { createConnectionError } from "./errors.js";
import { logger } from "./logging.js";
import type { SessionManager } from "./session.js";

export type TunnelType = "local" | "remote" | "dynamic";

export interface TunnelConfig {
  sessionId: string;
  type: TunnelType;
  localHost?: string;
  localPort: number;
  remoteHost?: string;
  remotePort?: number;
}

export interface TunnelInfo {
  id: string;
  sessionId: string;
  type: TunnelType;
  localHost: string;
  localPort: number;
  remoteHost: string;
  remotePort: number;
  createdAt: number;
  active: boolean;
}

export interface TunnelService {
  createLocalForward(
    sessionId: string,
    localPort: number,
    remoteHost: string,
    remotePort: number,
  ): Promise<TunnelInfo>;
  createRemoteForward(
    sessionId: string,
    remotePort: number,
    localHost: string,
    localPort: number,
  ): Promise<TunnelInfo>;
  closeTunnel(tunnelId: string): Promise<boolean>;
  listTunnels(sessionId?: string): TunnelInfo[];
  closeSessionTunnels(sessionId: string): Promise<number>;
}

export interface TunnelServiceDeps {
  sessionManager: Pick<SessionManager, "getSession">;
}

class TunnelManager {
  private readonly tunnels = new Map<string, TunnelInfo>();
  private tunnelCounter = 0;

  constructor(private readonly sessionManager: Pick<SessionManager, "getSession">) {}

  async createLocalTunnel(config: TunnelConfig): Promise<TunnelInfo> {
    const { sessionId, localPort, remoteHost = "localhost", remotePort } = config;

    logger.debug("Creating local tunnel", {
      sessionId,
      localPort,
      remoteHost,
      remotePort,
    });

    const session = this.sessionManager.getSession(sessionId);
    if (!session) {
      throw createConnectionError("Session not found or expired");
    }

    const tunnelId = `tunnel-${Date.now()}-${++this.tunnelCounter}`;
    const localHost = config.localHost ?? "localhost";
    const targetPort = remotePort ?? localPort;

    const tunnelInfo: TunnelInfo = {
      id: tunnelId,
      sessionId,
      type: "local",
      localHost,
      localPort,
      remoteHost,
      remotePort: targetPort,
      createdAt: Date.now(),
      active: true,
    };

    this.tunnels.set(tunnelId, tunnelInfo);

    logger.info("Local tunnel created", {
      tunnelId,
      localPort,
      remoteHost,
      remotePort: targetPort,
    });

    return tunnelInfo;
  }

  async createRemoteTunnel(config: TunnelConfig): Promise<TunnelInfo> {
    const { sessionId, localPort, remoteHost = "localhost", remotePort } = config;

    logger.debug("Creating remote tunnel", {
      sessionId,
      localPort,
      remoteHost,
      remotePort,
    });

    const session = this.sessionManager.getSession(sessionId);
    if (!session) {
      throw createConnectionError("Session not found or expired");
    }

    const tunnelId = `tunnel-${Date.now()}-${++this.tunnelCounter}`;
    const localHost = config.localHost ?? "localhost";
    const targetPort = remotePort ?? localPort;

    const tunnelInfo: TunnelInfo = {
      id: tunnelId,
      sessionId,
      type: "remote",
      localHost,
      localPort,
      remoteHost,
      remotePort: targetPort,
      createdAt: Date.now(),
      active: true,
    };

    this.tunnels.set(tunnelId, tunnelInfo);

    logger.info("Remote tunnel created", {
      tunnelId,
      remotePort: targetPort,
      localHost,
      localPort,
    });

    return tunnelInfo;
  }

  async closeTunnel(tunnelId: string): Promise<boolean> {
    const tunnel = this.tunnels.get(tunnelId);
    if (!tunnel) {
      logger.warn("Tunnel not found", { tunnelId });
      return false;
    }

    tunnel.active = false;
    this.tunnels.delete(tunnelId);
    logger.info("Tunnel closed", { tunnelId });
    return true;
  }

  listTunnels(sessionId?: string): TunnelInfo[] {
    const tunnels = Array.from(this.tunnels.values());
    return sessionId ? tunnels.filter((tunnel) => tunnel.sessionId === sessionId) : tunnels;
  }

  async closeSessionTunnels(sessionId: string): Promise<number> {
    const sessionTunnels = this.listTunnels(sessionId);
    let closed = 0;

    for (const tunnel of sessionTunnels) {
      if (await this.closeTunnel(tunnel.id)) {
        closed++;
      }
    }

    return closed;
  }
}

export function createTunnelService({ sessionManager }: TunnelServiceDeps): TunnelService {
  const manager = new TunnelManager(sessionManager);

  return {
    createLocalForward(
      sessionId: string,
      localPort: number,
      remoteHost: string,
      remotePort: number,
    ): Promise<TunnelInfo> {
      return manager.createLocalTunnel({
        sessionId,
        type: "local",
        localPort,
        remoteHost,
        remotePort,
      });
    },
    createRemoteForward(
      sessionId: string,
      remotePort: number,
      localHost: string,
      localPort: number,
    ): Promise<TunnelInfo> {
      return manager.createRemoteTunnel({
        sessionId,
        type: "remote",
        localHost,
        localPort,
        remoteHost: "localhost",
        remotePort,
      });
    },
    closeTunnel(tunnelId: string): Promise<boolean> {
      return manager.closeTunnel(tunnelId);
    },
    listTunnels(sessionId?: string): TunnelInfo[] {
      return manager.listTunnels(sessionId);
    },
    closeSessionTunnels(sessionId: string): Promise<number> {
      return manager.closeSessionTunnels(sessionId);
    },
  };
}

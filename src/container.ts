import { ConfigManager, type ServerConfig } from "./config.js";
import { MetricsCollector } from "./metrics.js";
import { RateLimiter } from "./rate-limiter.js";
import { SessionManager } from "./session.js";

export interface AppContainer {
  config: ConfigManager;
  rateLimiter: RateLimiter;
  metrics: MetricsCollector;
  sessionManager: SessionManager;
}

export function createContainer(configOverrides: Partial<ServerConfig> = {}): AppContainer {
  const config = new ConfigManager(configOverrides);
  const rateLimiter = new RateLimiter({
    maxRequests: config.get("rateLimit").maxRequests,
    windowMs: config.get("rateLimit").windowMs,
    blockOnLimit: true,
  });
  const metrics = new MetricsCollector();
  const sessionManager = new SessionManager(
    config.get("maxSessions"),
    config.get("sessionTtlMs"),
    config.get("cleanupIntervalMs"),
  );

  return {
    config,
    rateLimiter,
    metrics,
    sessionManager,
  };
}

export function createTestContainer(overrides: Partial<AppContainer> = {}): AppContainer {
  const config =
    overrides.config ??
    new ConfigManager({
      maxSessions: 5,
      sessionTtlMs: 5_000,
      cleanupIntervalMs: 60_000,
      rateLimit: {
        enabled: false,
        maxRequests: 1_000,
        windowMs: 60_000,
      },
    });

  return {
    config,
    rateLimiter:
      overrides.rateLimiter ??
      new RateLimiter({
        maxRequests: config.get("rateLimit").maxRequests,
        windowMs: config.get("rateLimit").windowMs,
        blockOnLimit: false,
      }),
    metrics: overrides.metrics ?? new MetricsCollector(),
    sessionManager:
      overrides.sessionManager ??
      new SessionManager(
        config.get("maxSessions"),
        config.get("sessionTtlMs"),
        config.get("cleanupIntervalMs"),
      ),
  };
}

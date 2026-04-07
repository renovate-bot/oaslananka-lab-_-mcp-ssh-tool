import type { AppContainer } from "../container.js";
import { createEnsureService } from "../ensure.js";
import { createFsService } from "../fs-tools.js";
import { createProcessService } from "../process.js";
import { createStreamingService } from "../streaming.js";
import { createTransferService } from "../transfer.js";
import { createTunnelService } from "../tunnel.js";
import { EnsureToolProvider } from "./ensure.provider.js";
import { FsToolProvider } from "./fs.provider.js";
import { ProcessToolProvider } from "./process.provider.js";
import { ToolRegistry } from "./registry.js";
import { SessionToolProvider } from "./session.provider.js";
import { SystemToolProvider } from "./system.provider.js";
import { TransferToolProvider } from "./transfer.provider.js";
import { TunnelToolProvider } from "./tunnel.provider.js";

export function createToolRegistry(container: AppContainer): ToolRegistry {
  const processService = createProcessService({
    sessionManager: container.sessionManager,
  });
  const fsService = createFsService({
    sessionManager: container.sessionManager,
    metrics: container.metrics,
  });
  const ensureService = createEnsureService({
    sessionManager: container.sessionManager,
    processService,
    fsService,
  });
  const streamingService = createStreamingService({
    sessionManager: container.sessionManager,
  });
  const transferService = createTransferService({
    sessionManager: container.sessionManager,
  });
  const tunnelService = createTunnelService({
    sessionManager: container.sessionManager,
  });

  return new ToolRegistry()
    .register(
      new SessionToolProvider({
        sessionManager: container.sessionManager,
        metrics: container.metrics,
      }),
    )
    .register(
      new ProcessToolProvider({
        processService,
        streamingService,
        metrics: container.metrics,
      }),
    )
    .register(new FsToolProvider({ fsService }))
    .register(new EnsureToolProvider({ ensureService }))
    .register(
      new SystemToolProvider({
        sessionManager: container.sessionManager,
        metrics: container.metrics,
      }),
    )
    .register(new TransferToolProvider({ transferService }))
    .register(new TunnelToolProvider({ tunnelService }));
}

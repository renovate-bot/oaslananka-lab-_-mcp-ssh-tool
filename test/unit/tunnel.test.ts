import { describe, expect, test } from "@jest/globals";
import { createTunnelService } from "../../src/tunnel.js";

describe("createTunnelService", () => {
  test("creates, lists, and closes tunnels", async () => {
    const service = createTunnelService({
      sessionManager: {
        getSession: () => ({ ssh: {} }) as any,
      },
    });

    const local = await service.createLocalForward("session-1", 8080, "db", 5432);
    const remote = await service.createRemoteForward("session-1", 9000, "localhost", 3000);

    expect(service.listTunnels()).toHaveLength(2);
    expect(service.listTunnels("session-1")).toEqual(expect.arrayContaining([local, remote]));
    await expect(service.closeTunnel(local.id)).resolves.toBe(true);
    await expect(service.closeSessionTunnels("session-1")).resolves.toBe(1);
  });

  test("throws when the backing session is missing", async () => {
    const service = createTunnelService({
      sessionManager: {
        getSession: () => undefined,
      },
    });

    await expect(service.createLocalForward("missing", 8080, "db", 5432)).rejects.toThrow(
      "Session not found or expired",
    );
  });
});

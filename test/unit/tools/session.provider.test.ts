import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const getConfiguredHosts = jest.fn() as any;
const resolveSSHHost = jest.fn() as any;

describe("SessionToolProvider", () => {
  beforeEach(() => {
    jest.resetModules();
    getConfiguredHosts.mockReset();
    resolveSSHHost.mockReset();
  });

  async function loadProvider() {
    jest.unstable_mockModule("../../../src/ssh-config.js", () => ({
      getConfiguredHosts,
      resolveSSHHost,
    }));

    return import("../../../src/tools/session.provider.js");
  }

  test("opens, closes, lists, and pings sessions", async () => {
    const { SessionToolProvider } = await loadProvider();
    const openSession = jest.fn(async () => ({
      sessionId: "session-1",
      host: "example.com",
      username: "demo",
      sftpAvailable: true,
      expiresInMs: 1000,
    }));
    const closeSession = jest.fn(async () => true);
    const provider = new SessionToolProvider({
      sessionManager: {
        openSession,
        closeSession,
        getActiveSessions: () => [
          {
            sessionId: "session-1",
            host: "example.com",
            username: "demo",
            port: 22,
            createdAt: 1,
            expiresAt: Date.now() + 1000,
            lastUsed: 1,
          },
        ],
        getSession: () => ({
          ssh: {
            execCommand: jest.fn(async () => ({ code: 0 })),
          },
          info: {
            host: "example.com",
            expiresAt: Date.now() + 1000,
          },
        }),
      } as any,
      metrics: {
        recordSessionCreated: jest.fn(),
        recordSessionClosed: jest.fn(),
      } as any,
    });

    await expect(
      provider.handleTool("ssh_open_session", {
        host: "example.com",
        username: "demo",
      }),
    ).resolves.toEqual(expect.objectContaining({ sessionId: "session-1" }));
    await expect(
      provider.handleTool("ssh_close_session", { sessionId: "session-1" }),
    ).resolves.toBe(true);
    await expect(provider.handleTool("ssh_list_sessions", {})).resolves.toEqual(
      expect.objectContaining({ count: 1 }),
    );
    await expect(provider.handleTool("ssh_ping", { sessionId: "session-1" })).resolves.toEqual(
      expect.objectContaining({ alive: true }),
    );
  });

  test("handles ssh-config backed tools", async () => {
    const { SessionToolProvider } = await loadProvider();
    const provider = new SessionToolProvider({
      sessionManager: {
        getActiveSessions: () => [],
        getSession: () => undefined,
      } as any,
      metrics: {
        recordSessionCreated: jest.fn(),
        recordSessionClosed: jest.fn(),
      } as any,
    });

    await expect(provider.handleTool("ssh_list_configured_hosts", {})).resolves.toEqual(
      expect.objectContaining({
        count: expect.any(Number),
        hosts: expect.any(Array),
      }),
    );
    await expect(provider.handleTool("ssh_resolve_host", { hostAlias: "web" })).resolves.toEqual(
      expect.objectContaining({
        host: expect.any(String),
      }),
    );
    await expect(provider.handleTool("ssh_ping", { sessionId: "missing" })).resolves.toEqual({
      alive: false,
      error: "Session not found or expired",
    });
  });
});

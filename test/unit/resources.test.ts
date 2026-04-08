import { afterAll, describe, expect, test } from "@jest/globals";
import { createTestContainer, type AppContainer } from "../../src/container.js";
import { listResources, readResource } from "../../src/resources.js";

async function destroyContainer(container: AppContainer): Promise<void> {
  container.rateLimiter.destroy();
  await container.sessionManager.destroy();
}

describe("resource helpers", () => {
  const container = createTestContainer();

  afterAll(async () => {
    await destroyContainer(container);
  });

  test("lists the built-in MCP resources", () => {
    const result = listResources();
    const uris = result.resources.map((resource) => resource.uri);

    expect(uris).toEqual(
      expect.arrayContaining([
        "mcp-ssh-tool://sessions/active",
        "mcp-ssh-tool://metrics/json",
        "mcp-ssh-tool://metrics/prometheus",
        "mcp-ssh-tool://ssh-config/hosts",
      ]),
    );
  });

  test("reads session and metrics resources", async () => {
    const sessions = await readResource("mcp-ssh-tool://sessions/active", container);
    const metrics = await readResource("mcp-ssh-tool://metrics/json", container);
    const prometheus = await readResource("mcp-ssh-tool://metrics/prometheus", container);

    expect(JSON.parse(sessions.contents[0]?.text ?? "null")).toEqual([]);
    expect(JSON.parse(metrics.contents[0]?.text ?? "{}")).toEqual(
      expect.objectContaining({
        sessions: expect.any(Object),
        commands: expect.any(Object),
      }),
    );
    expect(prometheus.contents[0]?.text).toContain("ssh_mcp_sessions_created");
  });

  test("reads configured SSH hosts as JSON", async () => {
    const hostsResource = await readResource("mcp-ssh-tool://ssh-config/hosts", container);
    const payload = JSON.parse(hostsResource.contents[0]?.text ?? "{}") as {
      hosts?: unknown;
    };

    expect(Array.isArray(payload.hosts)).toBe(true);
  });

  test("throws for unknown resources", async () => {
    await expect(readResource("mcp-ssh-tool://missing", container)).rejects.toThrow(
      "Unknown resource",
    );
  });
});

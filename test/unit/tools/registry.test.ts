import { describe, expect, test } from "@jest/globals";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { ToolRegistry } from "../../../src/tools/registry.js";
import type { ToolProvider } from "../../../src/tools/types.js";

function makeProvider(namespace: string, toolName: string): ToolProvider {
  return {
    namespace,
    getTools(): Tool[] {
      return [
        {
          name: toolName,
          description: toolName,
          inputSchema: { type: "object", properties: {} },
        },
      ];
    },
    handleTool(name: string): Promise<unknown> | undefined {
      if (name === toolName) {
        return Promise.resolve({ tool: name });
      }
      return undefined;
    },
  };
}

describe("ToolRegistry", () => {
  test("registers providers and lists tools", () => {
    const registry = new ToolRegistry()
      .register(makeProvider("a", "tool_a"))
      .register(makeProvider("b", "tool_b"));

    expect(registry.getAllTools().map((tool) => tool.name)).toEqual(
      expect.arrayContaining(["tool_a", "tool_b"]),
    );
  });

  test("throws on duplicate namespaces", () => {
    const registry = new ToolRegistry().register(makeProvider("dup", "tool_a"));
    expect(() => registry.register(makeProvider("dup", "tool_b"))).toThrow("already registered");
  });

  test("dispatches tools and aliases", async () => {
    const registry = new ToolRegistry().register(makeProvider("session", "ssh_open_session"));

    const direct = await registry.dispatch("ssh_open_session", {});
    const alias = await registry.dispatch("ssh.openSession", {});
    const aliasContent =
      alias.content[0] && alias.content[0].type === "text" ? alias.content[0].text : "";

    expect(direct.isError).toBeFalsy();
    expect(aliasContent).toContain("ssh_open_session");
  });

  test("returns structured errors and unknown-tool responses", async () => {
    const registry = new ToolRegistry().register({
      namespace: "broken",
      getTools: () => [],
      handleTool(name: string): Promise<unknown> | undefined {
        if (name === "broken_tool") {
          return Promise.reject(new Error("boom"));
        }
        return undefined;
      },
    });

    await expect(registry.dispatch("broken_tool", {})).resolves.toEqual(
      expect.objectContaining({ isError: true }),
    );
    await expect(registry.dispatch("missing_tool", {})).resolves.toEqual(
      expect.objectContaining({ isError: true }),
    );
  });
});

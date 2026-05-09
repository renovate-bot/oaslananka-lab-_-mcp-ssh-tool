import { describe, expect, jest, test } from "@jest/globals";
import { ProcessToolProvider } from "../../../src/tools/process.provider.js";

describe("ProcessToolProvider", () => {
  test("dispatches command tools", async () => {
    const provider = new ProcessToolProvider({
      processService: {
        execCommand: jest.fn(async () => ({
          code: 0,
          stdout: "ok",
          stderr: "",
          durationMs: 5,
        })),
        execSudo: jest.fn(async () => ({
          code: 0,
          stdout: "sudo",
          stderr: "",
          durationMs: 5,
        })),
      } as any,
      streamingService: {
        execWithStreaming: jest.fn(async () => ({
          code: 0,
          chunks: [],
          stdout: "stream",
          stderr: "",
          durationMs: 5,
          truncated: false,
        })),
      },
      metrics: {
        recordCommand: jest.fn(),
      } as any,
    });

    await expect(
      provider.handleTool("proc_exec", {
        sessionId: "session-1",
        command: "echo ok",
      }),
    ).resolves.toEqual(expect.objectContaining({ stdout: "ok" }));
    await expect(
      provider.handleTool("proc_sudo", {
        sessionId: "session-1",
        command: "id",
      }),
    ).resolves.toEqual(expect.objectContaining({ stdout: "sudo" }));
    await expect(
      provider.handleTool("proc_exec_stream", {
        sessionId: "session-1",
        command: "tail -f",
      }),
    ).resolves.toEqual(expect.objectContaining({ stdout: "stream" }));
    expect(provider.handleTool("missing", {})).toBeUndefined();
  });
});

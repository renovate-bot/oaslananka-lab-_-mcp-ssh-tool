import { describe, expect, jest, test } from "@jest/globals";
import { createStreamingService, formatStreamOutput } from "../../src/streaming.js";

describe("createStreamingService", () => {
  test("streams stdout and stderr chunks", async () => {
    const execCommand = jest.fn(
      async (
        _command: string,
        options?: { onStdout?: (chunk: Buffer) => void; onStderr?: (chunk: Buffer) => void },
      ) => {
        options?.onStdout?.(Buffer.from("hello"));
        options?.onStderr?.(Buffer.from("warn"));
        return { code: 0 };
      },
    );
    const service = createStreamingService({
      sessionManager: {
        getSession: () => ({ ssh: { execCommand } }) as any,
        getOSInfo: async () => ({
          platform: "linux",
          distro: "ubuntu",
          version: "22.04",
          arch: "x64",
          shell: "bash",
          packageManager: "apt",
          init: "systemd",
          defaultShell: "bash",
        }),
      },
    });
    const onChunk = jest.fn();

    const result = await service.execWithStreaming({
      sessionId: "session-1",
      command: "echo hello",
      onChunk,
    });

    expect(result.code).toBe(0);
    expect(result.stdout).toBe("hello");
    expect(result.stderr).toBe("warn");
    expect(result.chunks.at(-1)?.type).toBe("exit");
    expect(onChunk).toHaveBeenCalled();
  });

  test("throws when session is missing", async () => {
    const service = createStreamingService({
      sessionManager: {
        getSession: () => undefined,
        getOSInfo: async () => {
          throw new Error("unreachable");
        },
      },
    });

    await expect(
      service.execWithStreaming({
        sessionId: "missing",
        command: "echo hi",
      }),
    ).rejects.toThrow("Session missing not found or expired");
  });

  test("formatStreamOutput concatenates non-exit chunks", () => {
    expect(
      formatStreamOutput([
        { type: "stdout", data: "a", timestamp: 1 },
        { type: "stderr", data: "b", timestamp: 2 },
        { type: "exit", code: 0, timestamp: 3 },
      ]),
    ).toBe("ab");
  });
});

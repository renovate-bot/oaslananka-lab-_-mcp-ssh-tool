import { logger } from "./logging.js";
import { buildRemoteCommand } from "./shell.js";
import type { SessionManager } from "./session.js";

export interface StreamChunk {
  type: "stdout" | "stderr" | "exit";
  data?: string;
  code?: number;
  timestamp: number;
}

export interface StreamOptions {
  sessionId: string;
  command: string;
  cwd?: string;
  env?: Record<string, string>;
  onChunk?: (chunk: StreamChunk) => void;
}

export interface StreamResult {
  code: number;
  chunks: StreamChunk[];
  stdout: string;
  stderr: string;
  durationMs: number;
}

export interface StreamingService {
  execWithStreaming(options: StreamOptions): Promise<StreamResult>;
}

export interface StreamingServiceDeps {
  sessionManager: Pick<SessionManager, "getSession" | "getOSInfo">;
}

export function createStreamingService({ sessionManager }: StreamingServiceDeps): StreamingService {
  async function execWithStreaming(options: StreamOptions): Promise<StreamResult> {
    const { sessionId, command, cwd, env, onChunk } = options;
    logger.debug("Starting streaming execution", { sessionId, command });

    const session = sessionManager.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found or expired`);
    }

    const osInfo = await sessionManager.getOSInfo(sessionId);
    const startTime = Date.now();
    const chunks: StreamChunk[] = [];
    let fullStdout = "";
    let fullStderr = "";

    return new Promise((resolve, reject) => {
      const shellCommand = buildRemoteCommand(command, osInfo, cwd, env);

      session.ssh
        .execCommand(shellCommand, {
          onStdout: (chunk: Buffer) => {
            const data = chunk.toString();
            fullStdout += data;

            const streamChunk: StreamChunk = {
              type: "stdout",
              data,
              timestamp: Date.now(),
            };
            chunks.push(streamChunk);
            onChunk?.(streamChunk);
          },
          onStderr: (chunk: Buffer) => {
            const data = chunk.toString();
            fullStderr += data;

            const streamChunk: StreamChunk = {
              type: "stderr",
              data,
              timestamp: Date.now(),
            };
            chunks.push(streamChunk);
            onChunk?.(streamChunk);
          },
        })
        .then((result) => {
          const exitChunk: StreamChunk = {
            type: "exit",
            code: result.code ?? 0,
            timestamp: Date.now(),
          };
          chunks.push(exitChunk);
          onChunk?.(exitChunk);

          const streamResult: StreamResult = {
            code: result.code ?? 0,
            chunks,
            stdout: fullStdout,
            stderr: fullStderr,
            durationMs: Date.now() - startTime,
          };

          logger.debug("Streaming execution completed", {
            sessionId,
            code: streamResult.code,
            chunkCount: chunks.length,
            durationMs: streamResult.durationMs,
          });

          resolve(streamResult);
        })
        .catch(reject);
    });
  }

  return { execWithStreaming };
}

export function formatStreamOutput(chunks: StreamChunk[]): string {
  return chunks
    .filter((chunk) => chunk.type !== "exit" && chunk.data)
    .map((chunk) => chunk.data)
    .join("");
}

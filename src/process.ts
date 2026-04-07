import { createSudoError, wrapError, createTimeoutError } from "./errors.js";
import { logger, createTimer } from "./logging.js";
import type { SessionManager } from "./session.js";
import { buildRemoteCommand, buildSudoCommand } from "./shell.js";
import type { ExecResult } from "./types.js";
import { ErrorCode } from "./types.js";

export interface ProcessService {
  execCommand(
    sessionId: string,
    command: string,
    cwd?: string,
    env?: Record<string, string>,
    timeoutMs?: number,
  ): Promise<ExecResult>;
  execSudo(
    sessionId: string,
    command: string,
    password?: string,
    cwd?: string,
    timeoutMs?: number,
  ): Promise<ExecResult>;
  commandExists(sessionId: string, command: string): Promise<boolean>;
  getAvailableShell(sessionId: string): Promise<string>;
  execWithShell(
    sessionId: string,
    command: string,
    cwd?: string,
    env?: Record<string, string>,
  ): Promise<ExecResult>;
}

export interface ProcessServiceDeps {
  sessionManager: Pick<SessionManager, "getSession" | "getOSInfo">;
}

export function createProcessService({ sessionManager }: ProcessServiceDeps): ProcessService {
  async function execCommand(
    sessionId: string,
    command: string,
    cwd?: string,
    env?: Record<string, string>,
    timeoutMs?: number,
  ): Promise<ExecResult> {
    logger.debug("Executing command", { sessionId, command, cwd, timeoutMs });

    const session = sessionManager.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found or expired`);
    }

    const osInfo = await sessionManager.getOSInfo(sessionId);
    const timer = createTimer();

    try {
      const shellCommand = buildRemoteCommand(command, osInfo, cwd, env);

      const result = timeoutMs
        ? await Promise.race([
            session.ssh.execCommand(shellCommand),
            new Promise<never>((_, reject) => {
              setTimeout(() => {
                reject(
                  createTimeoutError(
                    `Command timed out after ${timeoutMs}ms`,
                    "Increase timeout or optimize the command",
                  ),
                );
              }, timeoutMs);
            }),
          ])
        : await session.ssh.execCommand(shellCommand);

      const execResult: ExecResult = {
        code: result.code ?? 0,
        stdout: result.stdout ?? "",
        stderr: result.stderr ?? "",
        durationMs: timer.elapsed(),
      };

      logger.debug("Command execution completed", {
        sessionId,
        code: execResult.code,
        durationMs: execResult.durationMs,
      });

      return execResult;
    } catch (error) {
      logger.error("Command execution failed", { sessionId, command, error });
      if ((error as { code?: ErrorCode } | undefined)?.code === ErrorCode.ETIMEOUT) {
        throw error;
      }
      throw wrapError(error, ErrorCode.ECONN, "Failed to execute command on remote system");
    }
  }

  async function execSudo(
    sessionId: string,
    command: string,
    password?: string,
    cwd?: string,
    timeoutMs?: number,
  ): Promise<ExecResult> {
    logger.debug("Executing sudo command", {
      sessionId,
      command,
      cwd,
      timeoutMs,
    });

    const session = sessionManager.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found or expired`);
    }

    const osInfo = await sessionManager.getOSInfo(sessionId);
    if (osInfo.platform === "windows") {
      throw createSudoError(
        "Sudo is not supported on Windows hosts",
        "Use an elevated session instead of sudo commands",
      );
    }

    const timer = createTimer();

    try {
      const fullCommand = buildSudoCommand(command, osInfo, password, cwd);
      const result = timeoutMs
        ? await Promise.race([
            session.ssh.execCommand(fullCommand),
            new Promise<never>((_, reject) => {
              setTimeout(() => {
                reject(
                  createTimeoutError(
                    `Sudo command timed out after ${timeoutMs}ms`,
                    "Increase timeout or optimize the command",
                  ),
                );
              }, timeoutMs);
            }),
          ])
        : await session.ssh.execCommand(fullCommand);

      if ((result.code ?? 0) !== 0 && result.stderr) {
        const stderrLower = result.stderr.toLowerCase();
        if (
          stderrLower.includes("password") ||
          stderrLower.includes("authentication") ||
          stderrLower.includes("sorry")
        ) {
          throw createSudoError(
            "Sudo authentication failed",
            "Provide a valid sudo password or ensure NOPASSWD is configured",
          );
        }
      }

      const execResult: ExecResult = {
        code: result.code ?? 0,
        stdout: result.stdout ?? "",
        stderr: result.stderr ?? "",
        durationMs: timer.elapsed(),
      };

      logger.debug("Sudo command execution completed", {
        sessionId,
        code: execResult.code,
        durationMs: execResult.durationMs,
      });

      return execResult;
    } catch (error) {
      if ((error as { code?: ErrorCode } | undefined)?.code === ErrorCode.ETIMEOUT) {
        throw error;
      }
      if (error instanceof Error && error.message.includes("sudo")) {
        throw error;
      }

      logger.error("Sudo command execution failed", {
        sessionId,
        command,
        error,
      });
      throw wrapError(error, ErrorCode.ENOSUDO, "Failed to execute sudo command on remote system");
    }
  }

  async function commandExists(sessionId: string, command: string): Promise<boolean> {
    try {
      const result = await execCommand(sessionId, `which ${command}`);
      return result.code === 0;
    } catch {
      return false;
    }
  }

  async function getAvailableShell(sessionId: string): Promise<string> {
    const shells = ["bash", "zsh", "sh"];

    for (const shell of shells) {
      if (await commandExists(sessionId, shell)) {
        logger.debug("Found available shell", { sessionId, shell });
        return shell;
      }
    }

    logger.warn("No standard shell found, defaulting to sh", { sessionId });
    return "sh";
  }

  async function execWithShell(
    sessionId: string,
    command: string,
    cwd?: string,
    env?: Record<string, string>,
  ): Promise<ExecResult> {
    const shell = await getAvailableShell(sessionId);
    let fullCommand = command;

    if (env && Object.keys(env).length > 0) {
      const envVars = Object.entries(env)
        .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
        .join(" ");
      fullCommand = `${envVars} ${command}`;
    }

    if (cwd) {
      fullCommand = `cd ${JSON.stringify(cwd)} && ${fullCommand}`;
    }

    return execCommand(sessionId, `${shell} -lc ${JSON.stringify(fullCommand)}`);
  }

  return {
    execCommand,
    execSudo,
    commandExists,
    getAvailableShell,
    execWithShell,
  };
}

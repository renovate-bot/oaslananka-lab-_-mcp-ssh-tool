import {
  createPackageManagerError,
  createSudoError,
  createFilesystemError,
  createPatchError,
  createBadRequestError,
} from "./errors.js";
import { logger } from "./logging.js";
import type { FsService } from "./fs-tools.js";
import type { ProcessService } from "./process.js";
import { resolveRemoteTempDir } from "./shell.js";
import type { SessionManager } from "./session.js";
import type {
  LinesInFileResult,
  PackageManager,
  PackageResult,
  PatchResult,
  ServiceResult,
} from "./types.js";

export interface EnsureService {
  ensurePackage(
    sessionId: string,
    packageName: string,
    sudoPassword?: string,
    state?: "present" | "absent",
  ): Promise<PackageResult>;
  ensureService(
    sessionId: string,
    serviceName: string,
    state: "started" | "stopped" | "restarted" | "enabled" | "disabled",
    sudoPassword?: string,
  ): Promise<ServiceResult>;
  ensureLinesInFile(
    sessionId: string,
    filePath: string,
    lines: string[],
    createIfMissing?: boolean,
    sudoPassword?: string,
    state?: "present" | "absent",
  ): Promise<LinesInFileResult>;
  applyPatch(
    sessionId: string,
    filePath: string,
    diff: string,
    sudoPassword?: string,
  ): Promise<PatchResult>;
}

export interface EnsureServiceDeps {
  sessionManager: Pick<SessionManager, "getSession" | "getOSInfo">;
  processService: Pick<ProcessService, "execCommand" | "execSudo" | "commandExists">;
  fsService: Pick<FsService, "readFile" | "writeFile" | "pathExists">;
}

function sanitizePackageName(name: string): string {
  const validPackageName = /^[a-zA-Z0-9][a-zA-Z0-9._+-]*$/;

  if (!validPackageName.test(name)) {
    throw createBadRequestError(
      `Invalid package name: ${name}`,
      "Package names must start with alphanumeric and contain only letters, numbers, dots, dashes, underscores, or plus signs",
    );
  }

  const dangerousChars = /[;&|`$(){}\[\]<>\\\"'\n\r]/;
  if (dangerousChars.test(name)) {
    throw createBadRequestError(
      "Package name contains potentially dangerous characters",
      "Remove any shell special characters from the package name",
    );
  }

  return name;
}

function getRemoveCommand(pm: PackageManager, packageName: string): string {
  switch (pm) {
    case "apt":
      return `apt-get remove -y ${packageName}`;
    case "dnf":
      return `dnf remove -y ${packageName}`;
    case "yum":
      return `yum remove -y ${packageName}`;
    case "pacman":
      return `pacman -R --noconfirm ${packageName}`;
    case "apk":
      return `apk del ${packageName}`;
    case "zypper":
      return `zypper remove -y ${packageName}`;
    case "brew":
      return `brew uninstall ${packageName}`;
    default:
      throw createPackageManagerError(`Unsupported package manager: ${pm}`);
  }
}

function getInstallCommand(pm: PackageManager, packageName: string): string {
  switch (pm) {
    case "apt":
      return `apt-get update && apt-get install -y ${packageName}`;
    case "dnf":
      return `dnf install -y ${packageName}`;
    case "yum":
      return `yum install -y ${packageName}`;
    case "pacman":
      return `pacman -S --noconfirm ${packageName}`;
    case "apk":
      return `apk add ${packageName}`;
    case "zypper":
      return `zypper install -y ${packageName}`;
    case "brew":
      return `brew install ${packageName}`;
    default:
      throw createPackageManagerError(`Unsupported package manager: ${pm}`);
  }
}

export function createEnsureService({
  sessionManager,
  processService,
  fsService,
}: EnsureServiceDeps): EnsureService {
  async function checkPackageInstalled(
    sessionId: string,
    packageName: string,
    pm: PackageManager,
  ): Promise<boolean> {
    let checkCommand: string;

    switch (pm) {
      case "apt":
        checkCommand = `dpkg -l ${packageName} | grep -q '^ii'`;
        break;
      case "dnf":
      case "yum":
        checkCommand = `${pm} list installed ${packageName}`;
        break;
      case "pacman":
        checkCommand = `pacman -Q ${packageName}`;
        break;
      case "apk":
        checkCommand = `apk info -e ${packageName}`;
        break;
      case "zypper":
        checkCommand = `zypper se -i ${packageName}`;
        break;
      case "brew":
        checkCommand = `brew list --versions ${packageName}`;
        break;
      default:
        return false;
    }

    try {
      const result = await processService.execCommand(sessionId, checkCommand);
      return result.code === 0;
    } catch {
      return false;
    }
  }

  async function ensurePackage(
    sessionId: string,
    packageName: string,
    sudoPassword?: string,
    state: "present" | "absent" = "present",
  ): Promise<PackageResult> {
    const safePackageName = sanitizePackageName(packageName);
    logger.debug("Ensuring package state", {
      sessionId,
      packageName: safePackageName,
      state,
    });

    const session = sessionManager.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found or expired`);
    }

    try {
      const osInfo = await sessionManager.getOSInfo(sessionId);
      const pm = osInfo.packageManager;

      if (pm === "unknown") {
        throw createPackageManagerError(
          "No supported package manager found",
          "Supported package managers: apt, dnf, yum, pacman, apk, zypper, brew",
        );
      }
      if (osInfo.platform === "windows") {
        throw createPackageManagerError(
          "Package management on Windows hosts is not supported by this tool yet",
          "Use winget/choco manually or install via other Windows package workflows",
        );
      }

      logger.debug("Detected package manager", { sessionId, pm });
      const isInstalled = await checkPackageInstalled(sessionId, safePackageName, pm);

      if (state === "absent") {
        if (!isInstalled) {
          logger.info("Package already not installed", {
            sessionId,
            packageName: safePackageName,
          });
          return {
            ok: true,
            pm,
            code: 0,
            stdout: `Package ${safePackageName} is not installed`,
            stderr: "",
          };
        }

        const removeCommand = getRemoveCommand(pm, safePackageName);
        logger.debug("Removing package", {
          sessionId,
          packageName: safePackageName,
          command: removeCommand,
        });

        const result =
          pm === "brew"
            ? await processService.execCommand(sessionId, removeCommand)
            : await processService.execSudo(sessionId, removeCommand, sudoPassword);

        const packageResult: PackageResult = {
          ok: result.code === 0,
          pm,
          code: result.code,
          stdout: result.stdout,
          stderr: result.stderr,
        };

        if (result.code === 0) {
          logger.info("Package removed successfully", {
            sessionId,
            packageName: safePackageName,
          });
        } else {
          logger.error("Package removal failed", {
            sessionId,
            packageName: safePackageName,
            code: result.code,
          });
        }

        return packageResult;
      }

      if (isInstalled) {
        logger.info("Package already installed", {
          sessionId,
          packageName: safePackageName,
        });
        return {
          ok: true,
          pm,
          code: 0,
          stdout: `Package ${safePackageName} is already installed`,
          stderr: "",
        };
      }

      const installCommand = getInstallCommand(pm, safePackageName);
      logger.debug("Installing package", {
        sessionId,
        packageName: safePackageName,
        command: installCommand,
      });

      const result =
        pm === "brew"
          ? await processService.execCommand(sessionId, installCommand)
          : await processService.execSudo(sessionId, installCommand, sudoPassword);

      const packageResult: PackageResult = {
        ok: result.code === 0,
        pm,
        code: result.code,
        stdout: result.stdout,
        stderr: result.stderr,
      };

      if (result.code === 0) {
        logger.info("Package installed successfully", {
          sessionId,
          packageName: safePackageName,
        });
      } else {
        logger.error("Package installation failed", {
          sessionId,
          packageName: safePackageName,
          code: result.code,
        });
      }

      return packageResult;
    } catch (error) {
      logger.error("Failed to ensure package", {
        sessionId,
        packageName,
        state,
        error,
      });
      throw error;
    }
  }

  async function ensureService(
    sessionId: string,
    serviceName: string,
    state: "started" | "stopped" | "restarted" | "enabled" | "disabled",
    sudoPassword?: string,
  ): Promise<ServiceResult> {
    logger.debug("Ensuring service state", { sessionId, serviceName, state });

    const session = sessionManager.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found or expired`);
    }

    try {
      const osInfo = await sessionManager.getOSInfo(sessionId);
      const initSystem = osInfo.init;

      if (initSystem === "launchd") {
        throw createSudoError(
          "launchd services are not managed by this tool",
          "Use launchctl directly on macOS hosts",
        );
      }

      if (initSystem === "windows-service") {
        throw createSudoError(
          "Windows services are not managed by this tool",
          "Use sc.exe or PowerShell to manage Windows services",
        );
      }

      if (initSystem === "unknown") {
        throw createSudoError(
          "No supported init system found",
          "Supported init systems: systemd, service",
        );
      }

      logger.debug("Detected init system", { sessionId, initSystem });

      let command: string;
      if (initSystem === "systemd") {
        switch (state) {
          case "started":
            command = `systemctl start ${serviceName}`;
            break;
          case "stopped":
            command = `systemctl stop ${serviceName}`;
            break;
          case "restarted":
            command = `systemctl restart ${serviceName}`;
            break;
          case "enabled":
            command = `systemctl enable ${serviceName}`;
            break;
          case "disabled":
            command = `systemctl disable ${serviceName}`;
            break;
        }
      } else {
        switch (state) {
          case "started":
            command = `service ${serviceName} start`;
            break;
          case "stopped":
            command = `service ${serviceName} stop`;
            break;
          case "restarted":
            command = `service ${serviceName} restart`;
            break;
          case "enabled":
            command = `chkconfig ${serviceName} on || update-rc.d ${serviceName} enable`;
            break;
          case "disabled":
            command = `chkconfig ${serviceName} off || update-rc.d ${serviceName} disable`;
            break;
        }
      }

      const result = await processService.execSudo(sessionId, command, sudoPassword);
      const serviceResult: ServiceResult = { ok: result.code === 0 };

      if (result.code === 0) {
        logger.info("Service state changed successfully", {
          sessionId,
          serviceName,
          state,
        });
      } else {
        logger.error("Service state change failed", {
          sessionId,
          serviceName,
          state,
          code: result.code,
          stderr: result.stderr,
        });
      }

      return serviceResult;
    } catch (error) {
      logger.error("Failed to ensure service state", {
        sessionId,
        serviceName,
        state,
        error,
      });
      throw error;
    }
  }

  async function ensureLinesInFile(
    sessionId: string,
    filePath: string,
    lines: string[],
    createIfMissing = true,
    sudoPassword?: string,
    state: "present" | "absent" = "present",
  ): Promise<LinesInFileResult> {
    logger.debug("Ensuring lines in file", {
      sessionId,
      filePath,
      lineCount: lines.length,
      state,
    });

    try {
      const osInfo = await sessionManager.getOSInfo(sessionId);
      let fileContent = "";
      let fileExists = false;

      if (await fsService.pathExists(sessionId, filePath)) {
        fileExists = true;
        fileContent = await fsService.readFile(sessionId, filePath);
      } else if (state === "absent") {
        logger.info("File does not exist, lines already absent", {
          sessionId,
          filePath,
        });
        return { ok: true, added: 0 };
      } else if (!createIfMissing) {
        throw createFilesystemError(`File ${filePath} does not exist and createIfMissing is false`);
      }

      const existingLines = fileContent.split("\n");

      if (state === "absent") {
        const filteredLines = existingLines.filter((line) => !lines.includes(line));

        if (filteredLines.length === existingLines.length) {
          logger.info("No lines to remove from file", { sessionId, filePath });
          return { ok: true, added: 0 };
        }

        const removedCount = existingLines.length - filteredLines.length;
        const newContent = filteredLines.join("\n");

        try {
          await fsService.writeFile(sessionId, filePath, newContent);
        } catch (error) {
          if (!sudoPassword) {
            throw error;
          }

          const tempDir = resolveRemoteTempDir(osInfo);
          const baseTempDir = tempDir.replace(/\/+$/, "");
          const tempFile = `${baseTempDir}/ssh-mcp-${Date.now()}.tmp`;
          await fsService.writeFile(sessionId, tempFile, newContent);

          const moveResult = await processService.execSudo(
            sessionId,
            `mv ${tempFile} ${filePath}`,
            sudoPassword,
          );

          if (moveResult.code !== 0) {
            throw createFilesystemError(
              `Failed to move temporary file to ${filePath}`,
              "Check file permissions and sudo access",
            );
          }
        }

        logger.info("Lines removed from file successfully", {
          sessionId,
          filePath,
          removed: removedCount,
        });
        return { ok: true, added: -removedCount };
      }

      const missingLines = lines.filter((line) => !existingLines.includes(line));
      if (missingLines.length === 0) {
        logger.info("All lines already exist in file", { sessionId, filePath });
        return { ok: true, added: 0 };
      }

      const newContent = fileExists
        ? `${fileContent}\n${missingLines.join("\n")}`
        : missingLines.join("\n");

      try {
        await fsService.writeFile(sessionId, filePath, newContent);
      } catch (error) {
        if (!sudoPassword) {
          throw error;
        }

        const tempDir = resolveRemoteTempDir(osInfo);
        const baseTempDir = tempDir.replace(/\/+$/, "");
        const tempFile = `${baseTempDir}/ssh-mcp-${Date.now()}.tmp`;
        await fsService.writeFile(sessionId, tempFile, newContent);

        const moveResult = await processService.execSudo(
          sessionId,
          `mv ${tempFile} ${filePath}`,
          sudoPassword,
        );

        if (moveResult.code !== 0) {
          throw createFilesystemError(
            `Failed to move temporary file to ${filePath}`,
            "Check file permissions and sudo access",
          );
        }
      }

      logger.info("Lines added to file successfully", {
        sessionId,
        filePath,
        added: missingLines.length,
      });
      return { ok: true, added: missingLines.length };
    } catch (error) {
      logger.error("Failed to ensure lines in file", {
        sessionId,
        filePath,
        state,
        error,
      });
      throw error;
    }
  }

  async function applyPatch(
    sessionId: string,
    filePath: string,
    diff: string,
    sudoPassword?: string,
  ): Promise<PatchResult> {
    logger.debug("Applying patch to file", { sessionId, filePath });

    try {
      const osInfo = await sessionManager.getOSInfo(sessionId);
      const hasPatch = await processService.commandExists(sessionId, "patch");
      if (!hasPatch) {
        throw createPatchError(
          "patch command not found on remote system",
          "Install patch utility or apply changes manually",
        );
      }

      const tempDir = resolveRemoteTempDir(osInfo);
      const baseTempDir = tempDir.replace(/\/+$/, "");
      const tempPatchFile = `${baseTempDir}/ssh-mcp-patch-${Date.now()}.patch`;
      await fsService.writeFile(sessionId, tempPatchFile, diff);

      try {
        const testResult = await processService.execCommand(
          sessionId,
          `patch --dry-run -p0 ${filePath} < ${tempPatchFile}`,
        );

        if (testResult.code !== 0) {
          throw createPatchError(
            "Patch would fail to apply",
            `Patch test failed: ${testResult.stderr}`,
          );
        }

        const applyCommand = `patch -p0 ${filePath} < ${tempPatchFile}`;
        const result = sudoPassword
          ? await processService.execSudo(sessionId, applyCommand, sudoPassword)
          : await processService.execCommand(sessionId, applyCommand);

        const patchResult: PatchResult = {
          ok: result.code === 0,
          changed: result.code === 0,
        };

        if (result.code === 0) {
          logger.info("Patch applied successfully", { sessionId, filePath });
        } else {
          logger.error("Patch application failed", {
            sessionId,
            filePath,
            code: result.code,
            stderr: result.stderr,
          });
        }

        return patchResult;
      } finally {
        try {
          const cleanupCommand =
            osInfo.platform === "windows"
              ? `Remove-Item -Path ${tempPatchFile} -Force -ErrorAction SilentlyContinue`
              : `rm -f ${tempPatchFile}`;
          await processService.execCommand(sessionId, cleanupCommand);
        } catch (error) {
          logger.warn("Failed to clean up temporary patch file", {
            tempPatchFile,
            error,
          });
        }
      }
    } catch (error) {
      logger.error("Failed to apply patch", { sessionId, filePath, error });
      throw error;
    }
  }

  return {
    ensurePackage,
    ensureService,
    ensureLinesInFile,
    applyPatch,
  };
}

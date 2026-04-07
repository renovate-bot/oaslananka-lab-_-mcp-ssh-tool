#!/usr/bin/env node

/**
 * SSH MCP Server - Entry Point
 *
 * A Model Context Protocol (MCP) server that provides SSH automation tools
 * for GitHub Copilot and VS Code. Supports remote command execution, file
 * operations, and system administration tasks over SSH.
 */

import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createContainer, type AppContainer } from "./container.js";
import { SSHMCPServer } from "./mcp.js";
import { logger } from "./logging.js";

function getPackageInfo() {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const pkgPath = path.resolve(__dirname, "..", "package.json");
    const raw = readFileSync(pkgPath, "utf8");
    return JSON.parse(raw) as { version?: string; name?: string };
  } catch {
    return {};
  }
}

function printHelp() {
  const pkg = getPackageInfo();
  const name = pkg.name ?? "mcp-ssh-tool";
  const version = pkg.version ? `v${pkg.version}` : "";
  const help = [
    `${name} ${version}`.trim(),
    "",
    "Usage:",
    "  mcp-ssh-tool             Start MCP server over stdio (default)",
    "  mcp-ssh-tool --help      Show this help",
    "  mcp-ssh-tool --version   Show version",
    "  mcp-ssh-tool --stdio     Force stdio mode (default)",
    "",
    "Examples:",
    "  Run as MCP stdio server: mcp-ssh-tool",
    "  Claude/VS Code config snippet:",
    '    { "servers": { "ssh-mcp": { "type": "stdio", "command": "mcp-ssh-tool", "args": [] }}}',
    "  Debug: MCP_STDIO=1 mcp-ssh-tool",
    "",
  ].join("\n");
  process.stdout.write(help);
}

function printVersion() {
  const pkg = getPackageInfo();
  process.stdout.write(`${pkg.version ?? "0.0.0"}\n`);
}

interface CliOptions {
  help: boolean;
  version: boolean;
  forceStdio: boolean;
}

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = {
    help: false,
    version: false,
    forceStdio: false,
  };

  for (const arg of argv) {
    switch (arg) {
      case "--help":
      case "-h":
        opts.help = true;
        break;
      case "--version":
      case "-v":
        opts.version = true;
        break;
      case "--stdio":
        opts.forceStdio = true;
        break;
      case "--no-stdio":
        process.stderr.write(
          "Error: --no-stdio is not supported. This server only runs over stdio.\n",
        );
        process.exit(2);
        break;
      default:
        // Ignore unknown flags to avoid breaking MCP client invocations
        break;
    }
  }

  return opts;
}

async function main() {
  const argv = process.argv.slice(2);
  const opts = parseArgs(argv);

  if (opts.help) {
    printHelp();
    process.exit(0);
  }

  if (opts.version) {
    printVersion();
    process.exit(0);
  }

  try {
    logger.info("Starting SSH MCP Server...");

    container = createContainer();
    const server = new SSHMCPServer(container);
    await server.run();

    // Gentle warning if a human types into the terminal
    let warned = false;
    process.stdin.on("data", (chunk: Buffer) => {
      const trimmed = chunk.toString().trimStart();
      if (!warned && trimmed && !trimmed.startsWith("{") && !trimmed.startsWith("[")) {
        process.stderr.write(
          "This is an MCP stdio server. Do not type commands here. Use an MCP client or run --help.\n",
        );
        warned = true;
      }
    });

    // Check if running in daemon mode (for testing)
    if (process.env.SSH_MCP_DAEMON === "true") {
      logger.info("Running in daemon mode - will not wait for stdin");
      // Keep alive but don't block on stdin
      setInterval(() => {}, 1000);
    } else if (process.env.SSH_MCP_ONESHOT === "true") {
      logger.info("Running in one-shot mode - will exit after processing");
      // Process stdin once and exit with timeout
      const timeout = setTimeout(() => {
        logger.info("One-shot mode timeout, exiting");
        process.exit(0);
      }, 2000);

      process.stdin.once("data", () => {
        clearTimeout(timeout);
        setTimeout(() => process.exit(0), 100);
      });
      process.stdin.resume();
    } else {
      // Keep the process running for MCP stdio communication
      process.stdin.resume();
    }
  } catch (error) {
    logger.error("Failed to start SSH MCP Server", { error });
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  logger.error("Uncaught exception", { error });
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled rejection", { reason, promise });
  process.exit(1);
});

// Handle graceful shutdown
let shuttingDown = false;
let container: AppContainer | undefined;

async function gracefulShutdown(signal: string) {
  if (shuttingDown) {
    // Second signal = force exit immediately
    logger.info("Force exit");
    process.exit(0);
  }
  shuttingDown = true;
  logger.info(`Received ${signal}, shutting down...`);

  // Force exit after 2 seconds max
  const forceExit = setTimeout(() => {
    logger.info("Shutdown timeout, forcing exit");
    process.exit(0);
  }, 2000);

  try {
    container?.rateLimiter.destroy();
    if (container) {
      await container.sessionManager.destroy();
    }
  } catch (error) {
    logger.error("Shutdown error", { error });
  }

  clearTimeout(forceExit);
  process.exit(0);
}

process.on("SIGINT", () => {
  void gracefulShutdown("SIGINT");
});
process.on("SIGTERM", () => {
  void gracefulShutdown("SIGTERM");
});

// Run the server
void main();

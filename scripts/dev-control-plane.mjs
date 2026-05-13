import { spawn } from "node:child_process";

const env = {
  ...process.env,
  SSHAUTOMATOR_REMOTE_AGENT_CONTROL_PLANE:
    process.env.SSHAUTOMATOR_REMOTE_AGENT_CONTROL_PLANE ?? "true",
  PUBLIC_BASE_URL: process.env.PUBLIC_BASE_URL ?? "http://localhost:3000",
  MCP_RESOURCE_URL: process.env.MCP_RESOURCE_URL ?? "http://localhost:3000/mcp",
  DATABASE_URL: process.env.DATABASE_URL ?? "file:./data/sshautomator.db",
  SSH_MCP_HTTP_HOST: process.env.SSH_MCP_HTTP_HOST ?? "127.0.0.1",
  SSH_MCP_HTTP_PORT: process.env.SSH_MCP_HTTP_PORT ?? "3000",
};

const child = spawn(
  process.execPath,
  ["dist/index.js", "http", "--host", env.SSH_MCP_HTTP_HOST, "--port", env.SSH_MCP_HTTP_PORT],
  {
    stdio: "inherit",
    env,
  },
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

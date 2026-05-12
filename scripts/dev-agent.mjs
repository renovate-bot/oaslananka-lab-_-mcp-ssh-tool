import { spawn } from "node:child_process";

const child = spawn(process.execPath, ["dist/index.js", "agent", "run"], {
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

#!/usr/bin/env node
import { execFileSync } from "node:child_process";

const pnpmArgs = ["pack", "--dry-run", "--json"];

function runPnpm(args) {
  const command = `corepack pnpm ${args.join(" ")}`;

  if (process.platform === "win32") {
    return execFileSync(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", command], {
      encoding: "utf8",
      windowsHide: true,
    });
  }

  try {
    return execFileSync("corepack", ["pnpm", ...args], {
      encoding: "utf8",
      windowsHide: true,
    });
  } catch {
    return execFileSync("pnpm", args, {
      encoding: "utf8",
      windowsHide: true,
    });
  }
}

const rawOutput = runPnpm(pnpmArgs);

const parsed = JSON.parse(rawOutput);
const packResult = Array.isArray(parsed) ? parsed[0] : parsed;
const files = Array.isArray(packResult?.files)
  ? packResult.files
  : Array.isArray(packResult?.contents)
    ? packResult.contents
    : [];
const filePaths = files
  .map((entry) => {
    if (typeof entry === "string") {
      return entry;
    }

    if (typeof entry?.path === "string") {
      return entry.path;
    }

    return "";
  })
  .map((filePath) => filePath.replaceAll("\\", "/"))
  .filter(Boolean);

const forbiddenPatterns = [
  /^test\//,
  /^coverage\//,
  /^test-results\//,
  /^\.github\//,
  /^\.changeset\//,
];
const leakedPaths = filePaths.filter((filePath) =>
  forbiddenPatterns.some((pattern) => pattern.test(filePath)),
);

if (leakedPaths.length > 0) {
  console.error("Unexpected files would be published to npm:");
  for (const filePath of leakedPaths) {
    console.error(` - ${filePath}`);
  }
  process.exit(1);
}

console.log(`Package dry-run looks clean (${filePaths.length} files).`);

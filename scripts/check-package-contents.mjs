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

function parsePackJson(output) {
  try {
    return JSON.parse(output);
  } catch {
    const lines = output.split(/\r?\n/u);
    for (let index = 0; index < lines.length; index += 1) {
      const first = lines[index]?.trim() ?? "";
      if (!first.startsWith("[") && !first.startsWith("{")) {
        continue;
      }
      let candidate = "";
      for (let end = index; end < lines.length; end += 1) {
        candidate = candidate.length > 0 ? `${candidate}\n${lines[end]}` : (lines[end] ?? "");
        try {
          return JSON.parse(candidate.trim());
        } catch {
          // Keep extending because lifecycle logs may surround the JSON payload.
        }
      }
    }
    throw new SyntaxError("Unable to parse pnpm pack --json output");
  }
}

const parsed = parsePackJson(rawOutput);
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

const requiredPaths = [
  "dist/index.js",
  "dist/index.d.ts",
  "package.json",
  "README.md",
  "LICENSE",
  "mcp.json",
  "server.json",
];
const forbiddenPatterns = [
  /^test\//,
  /^coverage\//,
  /^test-results\//,
  /^node_modules\//,
  /^\.github\//,
  /^\.changeset\//,
  /^\.env(?:\.|$)/,
  /^\.agent\//,
  /^\.cursor\//,
  /^\.claude\//,
  /^\.codex\//,
  /(?:^|\/)(?:prompt|prompts|instructions|scratch|notes\.local)\.md$/u,
  /\.(?:prompt|scratch|chat|transcript)\./u,
];
const missingPaths = requiredPaths.filter((requiredPath) => !filePaths.includes(requiredPath));
const leakedPaths = filePaths.filter((filePath) =>
  forbiddenPatterns.some((pattern) => pattern.test(filePath)),
);

if (missingPaths.length > 0) {
  console.error("Required files are missing from the npm package dry-run:");
  for (const filePath of missingPaths) {
    console.error(` - ${filePath}`);
  }
  process.exit(1);
}

if (leakedPaths.length > 0) {
  console.error("Unexpected files would be published to npm:");
  for (const filePath of leakedPaths) {
    console.error(` - ${filePath}`);
  }
  process.exit(1);
}

console.log(`Package dry-run looks clean (${filePaths.length} files).`);

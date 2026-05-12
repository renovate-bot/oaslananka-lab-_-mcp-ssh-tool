#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

const outputPath = "artifacts/sbom.cdx.json";
const pnpmArgs = ["sbom", "--sbom-format", "cyclonedx"];

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

mkdirSync("artifacts", { recursive: true });
writeFileSync(outputPath, runPnpm(pnpmArgs));
console.log(`CycloneDX SBOM written to ${outputPath}.`);

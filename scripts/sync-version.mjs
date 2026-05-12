#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const checkOnly = process.argv.includes("--check");

const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const version = pkg.version;
const mismatches = [];

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function writeJson(relativePath, value) {
  fs.writeFileSync(path.join(root, relativePath), `${JSON.stringify(value, null, 2)}\n`);
}

function assertVersion(label, actual) {
  if (actual !== version) {
    mismatches.push(`${label}: expected ${version}, found ${actual}`);
  }
}

console.log(`${checkOnly ? "Checking" : "Syncing"} version ${version} across metadata...`);

if (fs.existsSync(path.join(root, "mcp.json"))) {
  const mcpJson = readJson("mcp.json");
  assertVersion("mcp.json", mcpJson.version);
  if (!checkOnly) {
    mcpJson.version = version;
    writeJson("mcp.json", mcpJson);
    console.log("  Updated: mcp.json");
  }
}

if (fs.existsSync(path.join(root, "server.json"))) {
  const serverJson = readJson("server.json");
  assertVersion("server.json", serverJson.version);
  if (Array.isArray(serverJson.packages)) {
    for (const [index, packageEntry] of serverJson.packages.entries()) {
      assertVersion(`server.json packages[${index}]`, packageEntry.version);
      if (!checkOnly) {
        packageEntry.version = version;
      }
    }
  }
  if (!checkOnly) {
    serverJson.version = version;
    writeJson("server.json", serverJson);
    console.log("  Updated: server.json");
  }
}

if (fs.existsSync(path.join(root, "registry", "mcp-ssh-tool", "mcp.json"))) {
  const registryJson = readJson("registry/mcp-ssh-tool/mcp.json");
  assertVersion("registry/mcp-ssh-tool/mcp.json", registryJson.version);
  if (!checkOnly) {
    registryJson.version = version;
    writeJson("registry/mcp-ssh-tool/mcp.json", registryJson);
    console.log("  Updated: registry/mcp-ssh-tool/mcp.json");
  }
}

const mcpTsPath = path.join(root, "src", "mcp.ts");
if (fs.existsSync(mcpTsPath)) {
  const mcpTs = fs.readFileSync(mcpTsPath, "utf8");
  const match = /export\s+const\s+SERVER_VERSION\s*=\s*["']([0-9]+\.[0-9]+\.[0-9]+)["']/.exec(
    mcpTs,
  );
  assertVersion("src/mcp.ts SERVER_VERSION", match?.[1]);
  if (!checkOnly) {
    fs.writeFileSync(
      mcpTsPath,
      mcpTs.replace(
        /export\s+const\s+SERVER_VERSION\s*=\s*["'][0-9]+\.[0-9]+\.[0-9]+["']/,
        `export const SERVER_VERSION = "${version}"`,
      ),
    );
    console.log("  Updated: src/mcp.ts");
  }
}

if (mismatches.length > 0) {
  console.error("\nVersion sync check failed:");
  for (const mismatch of mismatches) {
    console.error(`  - ${mismatch}`);
  }
  process.exit(1);
}

console.log(checkOnly ? "Version metadata is synchronized." : "Done. All files synced.");

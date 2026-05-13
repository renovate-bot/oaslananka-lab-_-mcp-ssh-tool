#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];

const EXPECTED = {
  packageName: "mcp-ssh-tool",
  mcpName: "io.github.oaslananka/mcp-ssh-tool",
  orgRepo: "https://github.com/oaslananka-lab/mcp-ssh-tool",
  packageRepo: "git+https://github.com/oaslananka-lab/mcp-ssh-tool.git",
  npmRegistry: "https://registry.npmjs.org",
  serverSchema: "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json",
};

function readText(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

function addError(message) {
  errors.push(message);
}

function assertEqual(label, actual, expected) {
  if (actual !== expected) {
    addError(`${label}: expected ${JSON.stringify(expected)}, found ${JSON.stringify(actual)}`);
  }
}

function assert(condition, message) {
  if (!condition) {
    addError(message);
  }
}

const pkg = readJson("package.json");
const server = readJson("server.json");
const mcp = readJson("mcp.json");
const registryMcp = readJson("registry/mcp-ssh-tool/mcp.json");
const mcpTs = readText("src/mcp.ts");

assertEqual("package.json name", pkg.name, EXPECTED.packageName);
assertEqual("package.json mcpName", pkg.mcpName, EXPECTED.mcpName);
assertEqual("package.json repository.url", pkg.repository?.url, EXPECTED.packageRepo);
assertEqual("package.json homepage", pkg.homepage, `${EXPECTED.orgRepo}#readme`);
assertEqual("package.json bugs.url", pkg.bugs?.url, `${EXPECTED.orgRepo}/issues`);
assertEqual("package.json main", pkg.main, "dist/index.js");
assertEqual("package.json bin.mcp-ssh-tool", pkg.bin?.["mcp-ssh-tool"], "dist/index.js");
assert(
  /^pnpm@\d+\.\d+\.\d+(?:[+-][0-9A-Za-z.-]+)?$/u.test(pkg.packageManager ?? ""),
  `package.json packageManager must pin pnpm, found ${JSON.stringify(pkg.packageManager)}`,
);

assertEqual("server.json $schema", server.$schema, EXPECTED.serverSchema);
assertEqual("server.json name", server.name, pkg.mcpName);
assertEqual("server.json version", server.version, pkg.version);
assertEqual("server.json repository.url", server.repository?.url, EXPECTED.orgRepo);
assertEqual("server.json repository.source", server.repository?.source, "github");
assert(Array.isArray(server.packages), "server.json packages must be an array");

const packages = Array.isArray(server.packages) ? server.packages : [];
const transports = new Set();
for (const [index, packageEntry] of packages.entries()) {
  assertEqual(`server.json packages[${index}].registryType`, packageEntry.registryType, "npm");
  assertEqual(
    `server.json packages[${index}].registryBaseUrl`,
    packageEntry.registryBaseUrl,
    EXPECTED.npmRegistry,
  );
  assertEqual(`server.json packages[${index}].identifier`, packageEntry.identifier, pkg.name);
  assertEqual(`server.json packages[${index}].version`, packageEntry.version, pkg.version);
  const transportType = packageEntry.transport?.type;
  assert(
    typeof transportType === "string",
    `server.json packages[${index}].transport.type is required`,
  );
  if (typeof transportType === "string") {
    transports.add(transportType);
  }
}

assert(transports.has("stdio"), "server.json must advertise npm stdio transport");
assert(
  transports.has("streamable-http"),
  "server.json must advertise npm Streamable HTTP transport for local loopback use",
);
const httpPackage = packages.find(
  (packageEntry) => packageEntry.transport?.type === "streamable-http",
);
if (httpPackage) {
  assert(
    typeof httpPackage.transport.url === "string" &&
      httpPackage.transport.url.startsWith("http://127.0.0.1:") &&
      httpPackage.transport.url.endsWith("/mcp"),
    "server.json Streamable HTTP transport must stay loopback-only",
  );
}

assertEqual("mcp.json name", mcp.name, pkg.name);
assertEqual("mcp.json version", mcp.version, pkg.version);
assertEqual("mcp.json transport", mcp.transport, "stdio");
assertEqual("mcp.json entrypoint", mcp.entrypoint, "dist/index.js");
assertEqual("registry/mcp-ssh-tool/mcp.json name", registryMcp.name, mcp.name);
assertEqual("registry/mcp-ssh-tool/mcp.json version", registryMcp.version, mcp.version);
assertEqual("registry/mcp-ssh-tool/mcp.json transport", registryMcp.transport, mcp.transport);
assertEqual("registry/mcp-ssh-tool/mcp.json entrypoint", registryMcp.entrypoint, mcp.entrypoint);

const versionMatch = /export\s+const\s+SERVER_VERSION\s*=\s*["']([^"']+)["']\s*;/u.exec(mcpTs);
const nameMatch = /export\s+const\s+SERVER_NAME\s*=\s*["']([^"']+)["']\s*;/u.exec(mcpTs);
assertEqual("src/mcp.ts SERVER_VERSION", versionMatch?.[1], pkg.version);
assertEqual("src/mcp.ts SERVER_NAME", nameMatch?.[1], pkg.mcpName);

if (errors.length > 0) {
  console.error("MCP metadata validation failed:");
  for (const error of errors) {
    console.error(`  - ${error}`);
  }
  process.exit(1);
}

console.log(
  `MCP metadata is consistent: ${pkg.name}@${pkg.version} / ${pkg.mcpName} / ${EXPECTED.orgRepo}`,
);

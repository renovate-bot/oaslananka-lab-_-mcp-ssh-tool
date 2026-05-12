#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), "utf8"));
}

function readText(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const pkg = readJson("package.json");
const config = readJson("release-please-config.json");
const manifest = readJson(".release-please-manifest.json");
const releaseWorkflow = readText(".github/workflows/release.yml");

assert(config["release-type"] === "node", "release-please root release-type must be node");
assert(
  config.packages && typeof config.packages === "object",
  "release-please packages map is missing",
);

const rootPackage = config.packages["."];
assert(rootPackage, "release-please must define the root package entry");
assert(
  rootPackage["package-name"] === pkg.name,
  "release-please package-name must match package.json",
);
assert(
  rootPackage["changelog-path"] === "CHANGELOG.md",
  "release-please changelog path must be CHANGELOG.md",
);
assert(manifest["."] === pkg.version, "release-please manifest version must match package.json");

const extraFilePaths = new Set(
  (rootPackage["extra-files"] ?? [])
    .map((entry) => {
      if (typeof entry === "string") {
        return entry;
      }

      if (typeof entry?.path === "string") {
        return entry.path;
      }

      return "";
    })
    .filter(Boolean),
);
for (const requiredPath of [
  "mcp.json",
  "server.json",
  "registry/mcp-ssh-tool/mcp.json",
  "src/mcp.ts",
]) {
  assert(
    extraFilePaths.has(requiredPath),
    `release-please extra-files must include ${requiredPath}`,
  );
}

for (const forbidden of [
  "workflow_dispatch.inputs.version",
  "github.event.inputs.version",
  "github.event.inputs.release_version",
  "github.event.inputs.tag",
  "github.event.inputs.TAG_NAME",
  "workflow_dispatch.inputs.TAG_NAME",
  "RELEASE_VERSION",
  "INPUT_VERSION",
]) {
  assert(
    !releaseWorkflow.includes(forbidden),
    `release workflow contains forbidden manual version input: ${forbidden}`,
  );
}

assert(
  /googleapis\/release-please-action@[0-9a-f]{40}/u.test(releaseWorkflow),
  "release workflow must use release-please pinned to a full commit SHA",
);
assert(
  releaseWorkflow.includes("needs.release.outputs.release_created == 'true'"),
  "release asset job must be gated by release-please release_created output",
);
assert(
  releaseWorkflow.includes("needs.release.outputs.tag_name"),
  "release workflow must derive the release tag from release-please outputs",
);
assert(
  releaseWorkflow.includes("needs.release.outputs.version"),
  "release workflow must derive the npm verification version from release-please outputs",
);

for (const removedWorkflow of [
  ".github/workflows/publish.yml",
  ".github/workflows/trusted-publish.yml",
]) {
  assert(
    !fs.existsSync(path.join(rootDir, removedWorkflow)),
    `${removedWorkflow} must remain removed`,
  );
}

console.log(`release-please manifest mode is configured for ${pkg.name}@${pkg.version}.`);

#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readinessPath = path.join(rootDir, "apps", "claude", "connector-readiness.json");
const errors = [];
const forbiddenRemoteToolPattern =
  /^(ssh_open_session|proc_exec|proc_sudo|fs_write|fs_rmrf|file_upload|file_download|tunnel_)/u;
const forbiddenTextPattern =
  /password|privateKey|privateKeyPath|passphrase|sudoPassword|bearer\s+[a-z0-9._-]+|token\s*[:=]/iu;

function addError(message) {
  errors.push(message);
}

function assert(condition, message) {
  if (!condition) {
    addError(message);
  }
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), "utf8"));
}

if (!fs.existsSync(readinessPath)) {
  console.error("Claude connector readiness file is missing: apps/claude/connector-readiness.json");
  process.exit(1);
}

const pkg = readJson("package.json");
const readiness = JSON.parse(fs.readFileSync(readinessPath, "utf8"));

function stringValues(value) {
  if (typeof value === "string") {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => stringValues(item));
  }
  if (value && typeof value === "object") {
    return Object.values(value).flatMap((item) => stringValues(item));
  }
  return [];
}

assert(readiness.schemaVersion === 1, "schemaVersion must be 1");
assert(readiness.publishReady === false, "publishReady must remain false until live setup exists");
assert(
  readiness.sourceRepository === "https://github.com/oaslananka/mcp-ssh-tool",
  "sourceRepository must point to the personal repository",
);
assert(
  readiness.automationRepository === "https://github.com/oaslananka-lab/mcp-ssh-tool",
  "automationRepository must point to the org repository",
);
assert(readiness.mcp?.serverName === pkg.mcpName, "mcp.serverName must match package.json mcpName");
assert(readiness.mcp?.packageName === pkg.name, "mcp.packageName must match package.json name");
assert(readiness.mcp?.version === pkg.version, "mcp.version must match package.json version");
assert(
  Array.isArray(readiness.mcp?.transports) && readiness.mcp.transports.includes("streamable-http"),
  "Claude Web connector must declare streamable-http transport",
);
assert(readiness.connector?.runtimeProfile === "claude", "runtimeProfile must be claude");
assert(
  readiness.connector?.credentialEntryInChat === false,
  "Claude connector must not accept credentials through chat",
);

const security = readiness.security ?? {};
assert(security.readOnlyDefaultProfile === true, "read-only profile must be default");
assert(security.hostAllowlistRequired === true, "host allowlist must be required");
assert(
  security.strictHostKeyVerificationDefault === true,
  "strict host-key verification must remain default",
);
assert(security.credentialEntryInChat === false, "credential entry in chat must be disabled");
assert(security.privateKeysInChat === false, "private keys in chat must be disabled");
assert(security.rawCommandExecutionDefault === false, "raw command execution must not be default");
assert(
  security.mutationToolsEnabledByDefault === false,
  "mutation tools must not be enabled by default",
);
assert(
  security.nonLoopbackHttpRequiresBearerAndOrigins === true,
  "non-loopback HTTP must require auth and allowed origins",
);
assert(
  security.nonLoopbackHttpRequiresRemoteSafeProfile === true,
  "non-loopback HTTP must require a restricted profile",
);
assert(
  security.nonLoopbackHttpRequiresStrictHostKeyPolicy === true,
  "non-loopback HTTP must require strict host-key policy",
);
assert(security.redactionRequired === true, "redaction must be required");

const toolProfile = readiness.toolProfile ?? {};
assert(toolProfile.name === "claude", "toolProfile.name must be claude");
for (const toolName of toolProfile.tools ?? []) {
  assert(!forbiddenRemoteToolPattern.test(toolName), `Claude profile exposes ${toolName}`);
}
const annotations = toolProfile.annotations ?? {};
for (const key of ["readOnlyHint", "destructiveHint", "openWorldHint"]) {
  assert(typeof annotations[key] === "boolean", `toolProfile.annotations.${key} must be boolean`);
}

assert(
  !stringValues(readiness).some((value) => forbiddenTextPattern.test(value)),
  "readiness file must not contain credential values",
);

if (readiness.publishReady === true) {
  const submission = readiness.submission ?? {};
  const endpoint = submission.publicHttpsMcpEndpoint;
  assert(
    typeof endpoint === "string" && endpoint.startsWith("https://"),
    "publishReady requires HTTPS MCP endpoint",
  );
  assert(
    !/localhost|127\.0\.0\.1|\[::1\]/u.test(endpoint),
    "publishReady endpoint cannot be loopback",
  );
  assert(submission.oauthConfigured === true, "publishReady requires OAuth/JWKS");
  assert(submission.allowedOriginsConfigured === true, "publishReady requires allowed origins");
  assert(submission.privacyPolicyReviewed === true, "publishReady requires privacy review");
  assert(submission.supportContactConfigured === true, "publishReady requires support contact");
  assert(submission.reviewTestCasesPrepared === true, "publishReady requires review test cases");
}

if (errors.length > 0) {
  console.error("Claude connector readiness validation failed:");
  for (const error of errors) {
    console.error(`  - ${error}`);
  }
  process.exit(1);
}

console.log("Claude connector readiness scaffold is safe and publish-disabled.");

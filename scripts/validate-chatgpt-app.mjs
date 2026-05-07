#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readinessPath = path.join(rootDir, "apps", "chatgpt", "app-readiness.json");
const errors = [];

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
  console.error("ChatGPT app readiness file is missing: apps/chatgpt/app-readiness.json");
  process.exit(1);
}

const pkg = readJson("package.json");
const readiness = JSON.parse(fs.readFileSync(readinessPath, "utf8"));
const forbiddenRemoteToolPattern =
  /^(ssh_open_session|proc_exec|proc_sudo|fs_write|fs_rmrf|file_upload|file_download|tunnel_)/u;
const forbiddenSchemaPattern =
  /password|privateKey|privateKeyPath|passphrase|sudoPassword|bearer|token/iu;

assert(readiness.schemaVersion === 1, "schemaVersion must be 1");
assert(
  readiness.publishReady === false,
  "publishReady must remain false until live OpenAI app setup is approved",
);
assert(
  readiness.canonicalRepository === "https://github.com/oaslananka-lab/mcp-ssh-tool",
  "canonicalRepository must point to the org repository",
);
assert(
  readiness.showcaseMirror === "https://github.com/oaslananka/mcp-ssh-tool",
  "showcaseMirror must point to the personal repository",
);
assert(readiness.mcp?.serverName === pkg.mcpName, "mcp.serverName must match package.json mcpName");
assert(readiness.mcp?.packageName === pkg.name, "mcp.packageName must match package.json name");
assert(readiness.mcp?.version === pkg.version, "mcp.version must match package.json version");
assert(
  Array.isArray(readiness.mcp?.transports) &&
    readiness.mcp.transports.includes("stdio") &&
    readiness.mcp.transports.includes("streamable-http"),
  "mcp.transports must include stdio and streamable-http",
);

const security = readiness.security ?? {};
assert(
  security.readOnlyDefaultProfile === true,
  "read-only inspection must be the default profile",
);
assert(security.hostAllowlistRequired === true, "host allowlist must be required");
assert(
  security.strictHostKeyVerificationDefault === true,
  "strict host-key verification must stay default",
);
assert(
  security.credentialEntryInChat === false,
  "normal chat credential entry must remain disabled",
);
assert(security.privateKeysInChat === false, "private keys must not be accepted in chat");
assert(security.rawCommandExecutionDefault === false, "raw command execution must not be default");
assert(
  security.destructiveToolsRequirePolicyAllow === true,
  "destructive tools must require policy allow",
);
assert(
  security.destructiveToolsRequireExplicitConfirmation === true,
  "destructive tools must require explicit confirmation",
);
assert(
  security.nonLoopbackHttpRequiresBearerAndOrigins === true,
  "non-loopback HTTP must require bearer auth and allowed origins",
);
assert(
  security.nonLoopbackHttpRequiresRemoteSafeProfile === true,
  "non-loopback HTTP must require a remote-safe connector profile",
);
assert(
  security.nonLoopbackHttpRequiresStrictHostKeyPolicy === true,
  "non-loopback HTTP must require strict host-key verification",
);
assert(security.auditLogsEnabled === true, "audit logs must be part of the app security model");
assert(security.redactionRequired === true, "redaction must be part of the app security model");

assert(
  readiness.connector?.runtimeProfile === "chatgpt",
  "connector.runtimeProfile must be chatgpt",
);
assert(
  readiness.connector?.credentialEntryInChat === false,
  "connector credential entry in chat must remain false",
);
assert(
  readiness.connector?.protectedResourceMetadata === "/.well-known/oauth-protected-resource",
  "connector protected resource metadata path must be declared",
);

const submission = readiness.submission ?? {};
assert(
  submission.dashboardConfigured === false,
  "dashboardConfigured must be false until reviewed",
);
assert(
  submission.publicHttpsMcpEndpoint === null,
  "publicHttpsMcpEndpoint must stay null until a production HTTPS endpoint exists",
);
assert(
  submission.domainVerificationConfigured === false,
  "domainVerificationConfigured must be false until live verification is complete",
);

for (const profile of readiness.toolProfiles ?? []) {
  const annotations = profile.annotations ?? {};
  for (const key of ["readOnlyHint", "destructiveHint", "openWorldHint"]) {
    assert(
      typeof annotations[key] === "boolean",
      `${profile.name} annotations.${key} must be boolean`,
    );
  }

  if (profile.enabledByDefault === false) {
    assert(profile.policyRequired === true, `${profile.name} must require policy allow`);
    assert(
      profile.explicitConfirmationRequired === true,
      `${profile.name} must require explicit confirmation`,
    );
  }

  for (const toolName of profile.tools ?? []) {
    assert(
      !forbiddenRemoteToolPattern.test(toolName),
      `${profile.name} must not expose dangerous tool ${toolName}`,
    );
    assert(
      !forbiddenSchemaPattern.test(toolName),
      `${profile.name} tool ${toolName} must not include credential-like names`,
    );
  }
}

if (readiness.publishReady === true) {
  const endpoint = submission.publicHttpsMcpEndpoint;
  assert(
    typeof endpoint === "string" && endpoint.startsWith("https://"),
    "publishReady requires HTTPS MCP endpoint",
  );
  assert(
    !/localhost|127\.0\.0\.1|\[::1\]/u.test(endpoint),
    "publishReady endpoint cannot be loopback",
  );
  assert(submission.dashboardConfigured === true, "publishReady requires OpenAI dashboard setup");
  assert(
    submission.domainVerificationConfigured === true,
    "publishReady requires domain verification",
  );
  assert(submission.componentCspConfigured === true, "publishReady requires component CSP");
  assert(submission.privacyPolicyReviewed === true, "publishReady requires privacy review");
  assert(submission.screenshotsPrepared === true, "publishReady requires screenshots");
  assert(submission.reviewTestCasesPrepared === true, "publishReady requires review test cases");
  assert(submission.oauthConfigured === true, "publishReady requires OAuth/JWKS configuration");
}

if (errors.length > 0) {
  console.error("ChatGPT app readiness validation failed:");
  for (const error of errors) {
    console.error(`  - ${error}`);
  }
  process.exit(1);
}

console.log("ChatGPT app readiness scaffold is safe and publish-disabled.");

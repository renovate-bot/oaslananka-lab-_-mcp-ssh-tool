#!/usr/bin/env node
import fs from "node:fs";

const FAILURE_CLASSES = {
  actionlint: {
    autoFixAllowed: true,
    humanApprovalRequired: false,
    patterns: [/actionlint/iu, /workflow syntax/iu],
    recommendedFix:
      "Run actionlint locally, correct YAML/event/expression syntax, and re-run workflow lints.",
    releasePublishMustStop: true,
    rootCause: "A GitHub Actions workflow has invalid syntax or an unsupported expression.",
  },
  "chatgpt-app-manifest-invalid": {
    autoFixAllowed: true,
    humanApprovalRequired: false,
    patterns: [/chatgpt app readiness validation failed/iu, /publishReady/iu],
    recommendedFix:
      "Keep publishing disabled, update apps/chatgpt/app-readiness.json or docs to match the validator, and do not add live app publish automation.",
    releasePublishMustStop: true,
    rootCause: "The ChatGPT app readiness scaffold drifted from the documented safe app posture.",
  },
  "claude-connector-readiness-invalid": {
    autoFixAllowed: true,
    humanApprovalRequired: false,
    patterns: [/Claude connector readiness validation failed/iu, /validate-claude-connector/iu],
    recommendedFix:
      "Keep publishing disabled, update apps/claude/connector-readiness.json or docs to match the validator, and do not add live Claude publish automation.",
    releasePublishMustStop: true,
    rootCause: "The Claude connector readiness scaffold drifted from the documented safe posture.",
  },
  "CodeQL finding": {
    autoFixAllowed: false,
    humanApprovalRequired: true,
    patterns: [/codeql/iu, /security-events/iu],
    recommendedFix:
      "Inspect the CodeQL alert, validate reachability, patch the source/sink path, and keep release workflows stopped until review.",
    releasePublishMustStop: true,
    rootCause: "Static analysis reported a JavaScript/TypeScript security finding.",
  },
  "dependency-cache/restore issue": {
    autoFixAllowed: true,
    humanApprovalRequired: false,
    patterns: [/cache (restore|save)/iu, /actions\/cache/iu, /cache-dependency-path/iu],
    recommendedFix:
      "Re-run once if infrastructure-related; otherwise correct cache keys or package-manager setup without changing release semantics.",
    releasePublishMustStop: false,
    rootCause:
      "A dependency cache restore/save operation failed independently of package correctness.",
  },
  "Docker build error": {
    autoFixAllowed: true,
    humanApprovalRequired: false,
    patterns: [/docker build/iu, /Dockerfile/iu, /failed to solve/iu],
    recommendedFix:
      "Reproduce with docker build, keep non-root/no-secret runtime constraints, and patch Dockerfile or .dockerignore only as needed.",
    releasePublishMustStop: true,
    rootCause: "The container image failed to build or smoke test.",
  },
  "Gitleaks finding": {
    autoFixAllowed: false,
    humanApprovalRequired: true,
    patterns: [/gitleaks/iu, /secret detected/iu],
    recommendedFix:
      "Stop release work, remove the secret from tracked content, rotate outside this workflow, and verify redacted scans.",
    releasePublishMustStop: true,
    rootCause: "Secret scanning found token-like or private material.",
  },
  "HTTP auth/origin regression": {
    autoFixAllowed: false,
    humanApprovalRequired: true,
    patterns: [/HTTP auth/iu, /allowed origin/iu, /non-loopback/iu, /bearer/iu],
    recommendedFix:
      "Restore bearer-token and allowed-origin enforcement before any non-loopback HTTP exposure.",
    releasePublishMustStop: true,
    rootCause: "Streamable HTTP safety checks failed.",
  },
  "remote connector unsafe profile exposure": {
    autoFixAllowed: false,
    humanApprovalRequired: true,
    patterns: [/ETOOLPROFILE/iu, /remote connector.*exposes/iu, /ssh_open_session.*chatgpt/iu],
    recommendedFix:
      "Restore restricted remote-safe/chatgpt/claude profile filtering and verify dangerous tools are hidden.",
    releasePublishMustStop: true,
    rootCause:
      "A remote connector profile exposes unsafe SSH, credential, mutation, or tunnel tools.",
  },
  "credential redaction regression": {
    autoFixAllowed: false,
    humanApprovalRequired: true,
    patterns: [
      /private key.*log/iu,
      /credential.*redaction/iu,
      /REDACTED/iu,
      /passphrase.*output/iu,
    ],
    recommendedFix:
      "Stop release work, remove exposed credential material from output/logs, and add targeted redaction tests.",
    releasePublishMustStop: true,
    rootCause: "A secret-like value may be visible in logs, tool output, or readiness metadata.",
  },
  "mcp-metadata-drift": {
    autoFixAllowed: true,
    humanApprovalRequired: false,
    patterns: [/MCP metadata validation failed/iu, /server\.json/iu, /mcp\.json/iu],
    recommendedFix:
      "Run npm run sync-version -- --check, update metadata consistently, and re-run validate:mcp-metadata.",
    releasePublishMustStop: true,
    rootCause:
      "Package, MCP Registry, legacy mcp.json, registry copy, or source constants diverged.",
  },
  "mcp-registry-schema-error": {
    autoFixAllowed: true,
    humanApprovalRequired: false,
    patterns: [/MCP Registry/iu, /schema/iu, /server\.schema\.json/iu],
    recommendedFix:
      "Validate server.json against the current registry schema and keep the existing server name unless migration is officially supported.",
    releasePublishMustStop: true,
    rootCause: "MCP Registry metadata does not match the current server schema.",
  },
  "mcp-registry-auth-mismatch": {
    autoFixAllowed: false,
    humanApprovalRequired: true,
    patterns: [/mcp-publisher login/iu, /DOPPLER_GITHUB_SERVICE_TOKEN/iu, /registry.*auth/iu],
    recommendedFix:
      "Verify MCP publisher authentication and Doppler configuration outside CI logs; do not print or rotate secrets from the workflow.",
    releasePublishMustStop: true,
    rootCause:
      "MCP Registry publish authentication does not match the configured publisher identity.",
  },
  "npm audit failure": {
    autoFixAllowed: true,
    humanApprovalRequired: false,
    patterns: [/npm audit/iu, /found \d+ vulnerabilities/iu],
    recommendedFix:
      "Upgrade the vulnerable dependency within supported Node/TypeScript ranges or document a reviewed advisory exception.",
    releasePublishMustStop: true,
    rootCause: "npm reported a moderate-or-higher vulnerability.",
  },
  "npm-package-upload-includes-non-package-assets": {
    autoFixAllowed: true,
    humanApprovalRequired: false,
    patterns: [/npm pack/iu, /package contents/iu, /release assets.*npm/iu],
    recommendedFix:
      "Correct package files/include rules so only intended runtime, metadata, and docs enter the npm tarball.",
    releasePublishMustStop: true,
    rootCause:
      "The npm package payload includes files that belong only in release artifacts or CI.",
  },
  "npm-trusted-publisher-mismatch": {
    autoFixAllowed: false,
    humanApprovalRequired: true,
    patterns: [/trusted publish/iu, /trusted publisher/iu, /id-token/iu, /provenance/iu],
    recommendedFix:
      "Verify npm trusted publisher repository, workflow file, and environment settings in npm and GitHub UI.",
    releasePublishMustStop: true,
    rootCause: "npm rejected OIDC/trusted-publishing identity or provenance context.",
  },
  "package-version-drift": {
    autoFixAllowed: true,
    humanApprovalRequired: false,
    patterns: [/version.*does not match/iu, /package-lock\.json version/iu],
    recommendedFix:
      "Run npm run sync-version and ensure package.json, lockfile, server.json, mcp.json, registry metadata, and src/mcp.ts agree.",
    releasePublishMustStop: true,
    rootCause: "Release version inputs and repository metadata are inconsistent.",
  },
  "personal-mirror-branch-divergence": {
    autoFixAllowed: false,
    humanApprovalRequired: true,
    patterns: [/personal.*main.*diverge/iu, /branch divergence/iu],
    recommendedFix:
      "Inspect both refs. Run mirror-personal.yml force mode only with explicit approval and force-with-lease.",
    releasePublishMustStop: false,
    rootCause:
      "The personal showcase main branch is not a fast-forward target from canonical main.",
  },
  "personal-mirror-tag-clobber": {
    autoFixAllowed: false,
    humanApprovalRequired: true,
    patterns: [/showcase tag .* diverges/iu, /divergent tag/iu],
    recommendedFix:
      "Do not clobber automatically. Use the documented force_mirror tag flow only after maintainer approval.",
    releasePublishMustStop: false,
    rootCause: "A personal showcase tag differs from the canonical tag.",
  },
  "sigstore/tool-bootstrap conflict": {
    autoFixAllowed: true,
    humanApprovalRequired: false,
    patterns: [/sigstore/iu, /\buv\b/iu, /tool-bootstrap/iu],
    recommendedFix:
      "Separate Sigstore tooling from uv-managed Python settings or pin the documented tool invocation.",
    releasePublishMustStop: true,
    rootCause: "Signing/provenance tooling is using conflicting Python tool configuration.",
  },
  "SSH policy regression": {
    autoFixAllowed: false,
    humanApprovalRequired: true,
    patterns: [/host-key/iu, /host key/iu, /sudo/iu, /path traversal/iu, /ssh-policy/iu],
    recommendedFix:
      "Restore strict host-key, sudo/destructive policy, allowlist, traversal, and redaction controls before merging.",
    releasePublishMustStop: true,
    rootCause: "A high-impact SSH safety invariant regressed.",
  },
  "test failure": {
    autoFixAllowed: true,
    humanApprovalRequired: false,
    patterns: [/FAIL /u, /jest/iu, /npm test/iu],
    recommendedFix:
      "Reproduce the failing test, patch behavior or exact fixture expectations, and avoid broad snapshots unless warranted.",
    releasePublishMustStop: true,
    rootCause: "Automated tests failed.",
  },
  "Trivy finding": {
    autoFixAllowed: false,
    humanApprovalRequired: true,
    patterns: [/trivy/iu, /CRITICAL/iu, /HIGH/iu],
    recommendedFix:
      "Inspect the SARIF/report, update the vulnerable package/base image, or document a reviewed exception.",
    releasePublishMustStop: true,
    rootCause: "Container/filesystem vulnerability scanning found a high-or-critical issue.",
  },
  "typecheck failure": {
    autoFixAllowed: true,
    humanApprovalRequired: false,
    patterns: [/tsc/iu, /TypeScript/iu, /typecheck/iu],
    recommendedFix:
      "Run npm run typecheck, fix the typed contract, and avoid suppressions unless the type boundary is intentionally opaque.",
    releasePublishMustStop: true,
    rootCause: "TypeScript compilation failed.",
  },
  "lint failure": {
    autoFixAllowed: true,
    humanApprovalRequired: false,
    patterns: [/eslint/iu, /lint/iu],
    recommendedFix:
      "Run npm run lint, apply the minimal style or correctness fix, and avoid disabling rules globally.",
    releasePublishMustStop: true,
    rootCause: "ESLint reported a style or static correctness issue.",
  },
  "workflow-syntax": {
    autoFixAllowed: true,
    humanApprovalRequired: false,
    patterns: [/invalid workflow/iu, /mapping values are not allowed/iu, /yaml/iu],
    recommendedFix:
      "Run actionlint and fix YAML syntax, event types, permissions, and expression contexts.",
    releasePublishMustStop: true,
    rootCause: "A workflow YAML file is syntactically invalid.",
  },
  zizmor: {
    autoFixAllowed: true,
    humanApprovalRequired: false,
    patterns: [/zizmor/iu, /unpinned-uses/iu, /template-injection/iu],
    recommendedFix:
      "Run zizmor offline, fix the reported workflow security issue, and keep org-only guards.",
    releasePublishMustStop: true,
    rootCause: "Workflow security lint reported a risky Actions pattern.",
  },
  "flaky/infra failure": {
    autoFixAllowed: true,
    humanApprovalRequired: false,
    patterns: [/timed out/iu, /502 Bad Gateway/iu, /ECONNRESET/iu, /rate limit/iu],
    recommendedFix:
      "Rerun only after confirming no deterministic source, security, package, or release-state failure is present.",
    releasePublishMustStop: false,
    rootCause: "The failure looks external or transient.",
  },
};

function usage() {
  console.log(`Usage: node scripts/classify-gh-failure.mjs [options]

Options:
  --class name        Return a known failure class directly.
  --log-file path    Read failure text from a log file.
  --text value       Classify the provided text.
  --json             Print machine-readable JSON. Default: human summary.
  --help             Show this help.

Classes:
  ${Object.keys(FAILURE_CLASSES).join("\n  ")}`);
}

function parseArgs(argv) {
  const options = { className: undefined, json: false, logFile: undefined, text: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case "--help":
      case "-h":
        usage();
        process.exit(0);
        break;
      case "--class":
        options.className = argv[++index];
        break;
      case "--json":
        options.json = true;
        break;
      case "--log-file":
        options.logFile = argv[++index];
        break;
      case "--text":
        options.text += `${argv[++index] ?? ""}\n`;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

function knownClass(name) {
  const entry = FAILURE_CLASSES[name];
  if (!entry) {
    return undefined;
  }
  return publicResult(name, 1, entry);
}

function publicResult(name, confidence, entry) {
  const { patterns, ...rest } = entry;
  void patterns;
  return { class: name, confidence, ...rest };
}

function classify(text) {
  const haystack = text.trim();
  if (!haystack) {
    return {
      autoFixAllowed: false,
      class: "unknown",
      confidence: 0,
      humanApprovalRequired: true,
      recommendedFix: "Collect the failed job log, then classify again with --log-file.",
      releasePublishMustStop: true,
      rootCause: "No failure text was provided.",
    };
  }

  for (const [name, entry] of Object.entries(FAILURE_CLASSES)) {
    if (entry.patterns.some((pattern) => pattern.test(haystack))) {
      return publicResult(name, 0.78, entry);
    }
  }

  return {
    autoFixAllowed: false,
    class: "unknown",
    confidence: 0.2,
    humanApprovalRequired: true,
    recommendedFix:
      "Inspect the failing job manually. Do not rerun publish/release workflows until the failure is classified.",
    releasePublishMustStop: true,
    rootCause: "The failure did not match a known repository operations class.",
  };
}

function renderHuman(result) {
  return [
    `class: ${result.class}`,
    `confidence: ${result.confidence}`,
    `root cause: ${result.rootCause}`,
    `recommended fix: ${result.recommendedFix}`,
    `auto-fix allowed: ${result.autoFixAllowed}`,
    `human approval required: ${result.humanApprovalRequired}`,
    `release/publish must stop: ${result.releasePublishMustStop}`,
  ].join("\n");
}

const options = parseArgs(process.argv.slice(2));
let stdinText = "";
if (!options.className && !options.text && !options.logFile && !process.stdin.isTTY) {
  stdinText = fs.readFileSync(0, "utf8");
}
const inputText = [
  options.text,
  options.logFile ? fs.readFileSync(options.logFile, "utf8") : "",
  stdinText,
].join("\n");

const result = options.className
  ? (knownClass(options.className) ??
    (() => {
      throw new Error(`Unknown failure class: ${options.className}`);
    })())
  : classify(inputText);

if (options.json) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(renderHuman(result));
}

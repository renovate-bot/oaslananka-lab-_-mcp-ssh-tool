#!/usr/bin/env node
import fs from "node:fs";

const ACTIONABLE_PATTERNS = [
  /\bBug:/iu,
  /\bPotential issue:/iu,
  /\bSuggested Fix\b/iu,
  /\bPrompt for AI Agent\b/iu,
  /\bsecurity\b/iu,
  /\bvulnerability\b/iu,
  /\bcorrectness\b/iu,
  /\brelease\b/iu,
  /\bpublish\b/iu,
  /\bworkflow\b/iu,
  /\bsecret\b/iu,
  /\btoken\b/iu,
  /\bunsafe\b/iu,
  /\bssh\b/iu,
  /\bcommand injection\b/iu,
  /\bhost key\b/iu,
  /\bknown_hosts\b/iu,
  /\bpath traversal\b/iu,
  /\bpassword\b/iu,
  /\bpassphrase\b/iu,
  /\bcredential\b/iu,
  /\bcredential broker\b/iu,
  /\bprivate key\b/iu,
  /\bOAuth\b/iu,
  /\bJWKS\b/iu,
  /\bbearer\b/iu,
  /\ballowed origins\b/iu,
  /\bChatGPT app\b/iu,
  /\bClaude connector\b/iu,
  /\bMCP Registry\b/iu,
  /\bnpm\b/iu,
  /\bGHCR\b/iu,
  /\bdestructive\b/iu,
  /\bsudo\b/iu,
  /\bfile write\b/iu,
  /\bfile delete\b/iu,
  /\btunnel\b/iu,
  /```suggestion\b/iu,
];

const BOT_LOGIN_PATTERNS = [
  /\[bot\]$/iu,
  /-bot$/iu,
  /^github-actions$/iu,
  /^dependabot/iu,
  /^renovate/iu,
  /^sentry/iu,
  /^gemini/iu,
  /^jules/iu,
  /^codex/iu,
  /^coderabbit/iu,
  /^socket/iu,
];

const SECRET_PATTERNS = [
  {
    pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/gu,
    replacement: "[REDACTED_PRIVATE_KEY]",
  },
  { pattern: /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/gu, replacement: "[REDACTED_GITHUB_TOKEN]" },
  { pattern: /\bnpm_[A-Za-z0-9]{20,}\b/gu, replacement: "[REDACTED_NPM_TOKEN]" },
  { pattern: /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}\b/giu, replacement: "Bearer [REDACTED]" },
  {
    pattern: /\b(token|secret|password|passphrase|private[_-]?key)\s*[:=]\s*["']?[^"'\s]{8,}/giu,
    replacement: "$1=[REDACTED]",
  },
];

function usage() {
  console.log(`Usage: node scripts/check-review-threads.mjs --repo owner/name --pr number [options]

Options:
  --repo owner/name          Repository to inspect.
  --pr number               Pull request number.
  --json                    Print the JSON summary to stdout.
  --fail-on-actionable      Exit non-zero when actionable unresolved threads exist.
  --summary-file path       Write the JSON summary to this path.
  --max-threads number      Number of review threads to fetch, 1-100. Default: 100.
  --help                    Show this help.

Requires GH_TOKEN or GITHUB_TOKEN with pull-requests:read. The script never
resolves review threads and redacts token-like values before writing output.`);
}

function parseArgs(argv) {
  const options = {
    failOnActionable: false,
    json: false,
    maxThreads: 100,
    pr: undefined,
    repo: undefined,
    summaryFile: undefined,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case "--help":
      case "-h":
        usage();
        process.exit(0);
        break;
      case "--repo":
        options.repo = argv[++index];
        break;
      case "--pr":
        options.pr = Number.parseInt(argv[++index] ?? "", 10);
        break;
      case "--json":
        options.json = true;
        break;
      case "--fail-on-actionable":
        options.failOnActionable = true;
        break;
      case "--summary-file":
        options.summaryFile = argv[++index];
        break;
      case "--max-threads":
        options.maxThreads = Number.parseInt(argv[++index] ?? "", 10);
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!options.repo || !/^[^/]+\/[^/]+$/u.test(options.repo)) {
    throw new Error("--repo must be in owner/name form");
  }

  if (!Number.isInteger(options.pr) || options.pr <= 0) {
    throw new Error("--pr must be a positive pull request number");
  }

  if (!Number.isInteger(options.maxThreads) || options.maxThreads < 1 || options.maxThreads > 100) {
    throw new Error("--max-threads must be between 1 and 100");
  }

  return options;
}

function redact(value) {
  let text = String(value ?? "");
  for (const { pattern, replacement } of SECRET_PATTERNS) {
    text = text.replace(pattern, replacement);
  }
  return text;
}

function preview(value, maxLength = 220) {
  const normalized = redact(value).replace(/\s+/gu, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 1)}...`;
}

function isBotLogin(login) {
  const normalized = String(login ?? "").trim();
  if (!normalized) {
    return true;
  }
  return BOT_LOGIN_PATTERNS.some((pattern) => pattern.test(normalized));
}

function isActionableBody(body) {
  return ACTIONABLE_PATTERNS.some((pattern) => pattern.test(body ?? ""));
}

async function graphql(query, variables) {
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("GH_TOKEN or GITHUB_TOKEN is required");
  }

  const response = await fetch("https://api.github.com/graphql", {
    body: JSON.stringify({ query, variables }),
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "user-agent": "mcp-ssh-tool-review-thread-gate",
    },
    method: "POST",
  });

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`GitHub GraphQL request failed with HTTP ${response.status}: ${body}`);
  }

  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    throw new Error(`GitHub GraphQL response was not valid JSON: ${body.slice(0, 200)}`);
  }
  if (payload.errors?.length) {
    throw new Error(`GitHub GraphQL errors: ${JSON.stringify(payload.errors)}`);
  }

  return payload.data;
}

function normalizeComment(comment) {
  const login = comment.author?.login ?? "unknown";
  const body = redact(comment.body ?? "");
  return {
    author: login,
    body,
    bodyPreview: preview(body),
    createdAt: comment.createdAt,
    isBot: isBotLogin(login),
    updatedAt: comment.updatedAt,
    url: comment.url,
  };
}

function classifyThread(thread) {
  const comments = (thread.comments?.nodes ?? []).map(normalizeComment);
  const humanComments = comments.filter((comment) => !comment.isBot);
  const actionableBotComments = comments.filter(
    (comment) => comment.isBot && isActionableBody(comment.body),
  );
  const reasons = [];

  if (thread.isResolved) {
    reasons.push("resolved");
    return { actionable: false, classification: "resolved", comments, reasons };
  }

  if (thread.isOutdated) {
    reasons.push("outdated");
    return { actionable: false, classification: "outdated", comments, reasons };
  }

  if (humanComments.length > 0) {
    reasons.push("unresolved human review thread");
    return { actionable: true, classification: "human-actionable", comments, reasons };
  }

  if (actionableBotComments.length > 0) {
    reasons.push("unresolved bot thread contains actionable release/security/correctness wording");
    return { actionable: true, classification: "bot-actionable", comments, reasons };
  }

  reasons.push("informational bot thread");
  return { actionable: false, classification: "bot-informational", comments, reasons };
}

function toSummary({ options, pullRequest }) {
  const threads = (pullRequest.reviewThreads?.nodes ?? []).map((thread) => {
    const classified = classifyThread(thread);
    return {
      actionable: classified.actionable,
      classification: classified.classification,
      comments: classified.comments,
      diffSide: thread.diffSide,
      id: thread.id,
      isOutdated: thread.isOutdated,
      isResolved: thread.isResolved,
      line: thread.line,
      originalLine: thread.originalLine,
      path: thread.path,
      reasons: classified.reasons,
      url: classified.comments.find((comment) => comment.url)?.url ?? pullRequest.url,
    };
  });

  const actionableThreads = threads.filter((thread) => thread.actionable);

  return {
    actionableCount: actionableThreads.length,
    generatedAt: new Date().toISOString(),
    ignoredCount: threads.length - actionableThreads.length,
    labels:
      actionableThreads.length > 0
        ? { add: ["review:blocked", "ci:hold"], remove: ["review:clean", "ci:ready"] }
        : { add: ["review:clean", "ci:ready"], remove: ["review:blocked", "ci:hold"] },
    maxThreads: options.maxThreads,
    pullRequest: {
      id: pullRequest.id,
      isDraft: pullRequest.isDraft,
      url: pullRequest.url,
    },
    repo: options.repo,
    pr: options.pr,
    threads,
    inspectedThreads: threads.length,
  };
}

function markdownSummary(summary) {
  const lines = [
    "## Review Thread Gate",
    "",
    `Repository: \`${summary.repo}\``,
    `Pull request: [#${summary.pr}](${summary.pullRequest.url})`,
    `Draft: \`${summary.pullRequest.isDraft}\``,
    `Threads inspected: \`${summary.inspectedThreads}\``,
    `Actionable unresolved threads: \`${summary.actionableCount}\``,
    "",
  ];

  if (summary.actionableCount === 0) {
    lines.push("No unresolved, not-outdated actionable review threads were found.");
    return `${lines.join("\n")}\n`;
  }

  lines.push("| Path | Line | Classification | Authors | Reason |");
  lines.push("| --- | ---: | --- | --- | --- |");
  for (const thread of summary.threads.filter((item) => item.actionable)) {
    const authors = [...new Set(thread.comments.map((comment) => comment.author))].join(", ");
    const line = thread.line ?? thread.originalLine ?? "";
    lines.push(
      `| ${thread.path ? `\`${thread.path}\`` : ""} | ${line} | ${thread.classification} | ${authors || "unknown"} | ${thread.reasons.join("; ")} |`,
    );
  }

  return `${lines.join("\n")}\n`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const [owner, name] = options.repo.split("/");
  const query = `query ReviewThreadGate($owner: String!, $name: String!, $pr: Int!, $maxThreads: Int!) {
    repository(owner: $owner, name: $name) {
      pullRequest(number: $pr) {
        id
        url
        isDraft
        reviewThreads(first: $maxThreads) {
          nodes {
            id
            isResolved
            isOutdated
            path
            line
            originalLine
            diffSide
            comments(first: 50) {
              nodes {
                author {
                  login
                }
                body
                url
                createdAt
                updatedAt
              }
            }
          }
        }
      }
    }
  }`;

  const data = await graphql(query, {
    maxThreads: options.maxThreads,
    name,
    owner,
    pr: options.pr,
  });
  const pullRequest = data.repository?.pullRequest;
  if (!pullRequest) {
    throw new Error(`Pull request not found: ${options.repo}#${options.pr}`);
  }

  const summary = toSummary({ options, pullRequest });
  const json = `${JSON.stringify(summary, null, 2)}\n`;

  if (options.summaryFile) {
    fs.writeFileSync(options.summaryFile, json);
  }

  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdownSummary(summary));
  }

  if (options.json) {
    process.stdout.write(json);
  } else if (summary.actionableCount > 0) {
    console.error(`Review thread gate found ${summary.actionableCount} actionable thread(s).`);
  } else {
    console.log(`Review thread gate clean: ${summary.inspectedThreads} thread(s) inspected.`);
  }

  if (options.failOnActionable && summary.actionableCount > 0) {
    process.exit(2);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

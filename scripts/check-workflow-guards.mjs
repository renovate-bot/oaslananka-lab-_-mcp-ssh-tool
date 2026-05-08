#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workflowDir = path.join(rootDir, ".github", "workflows");
const requiredGuard = "github.repository == 'oaslananka-lab/mcp-ssh-tool'";
const errors = [];
const forbiddenContent = [
  [/\bubuntu-latest\b/u, "use a pinned runner image instead of ubuntu-latest"],
  [/\bpull_request_target\b/u, "pull_request_target is not allowed"],
  [/\bpackage-lock\.json\b/u, "package-lock.json is not used; use pnpm-lock.yaml"],
  [/\bnpm\s+ci\b/u, "npm ci is not allowed; use pnpm install --frozen-lockfile"],
  [/\bnpm\s+install\b/u, "npm install is not allowed; use pnpm"],
  [/\bnpm\s+run\b/u, "npm run is not allowed in workflows; use pnpm run"],
  [/\bnpm\s+test\b/u, "npm test is not allowed in workflows; use pnpm test"],
  [/\buse-ci-npm\b/u, "use-ci-npm has been removed"],
  [/\bpython3\s+-m\s+pip\b/u, "pip bootstrap is not allowed in workflows; use uv"],
  [/\bpip\s+install\b/u, "pip install is not allowed in workflows; use uv"],
  [/^\s*cache:\s*pnpm\s*$/mu, "setup-node pnpm cache is disabled to avoid missing pnpm bootstrap"],
  [/^\s*cache-dependency-path:\s*/mu, "setup-node cache-dependency-path is not used"],
  [/^\s*if:\s*(?:\$\{\{\s*)?true(?:\s*\}\})?\s*$/mu, "business logic must not use if: true"],
  [/\|\|\s*true/u, "do not hide failures with || true"],
  [/\|\|\s*:/u, "do not hide failures with || :"],
];

function readWorkflowFiles() {
  if (!fs.existsSync(workflowDir)) {
    return [];
  }

  return fs
    .readdirSync(workflowDir)
    .filter((name) => /\.(ya?ml)$/u.test(name))
    .sort()
    .map((name) => path.join(workflowDir, name));
}

function findJobBlocks(content) {
  const lines = content.split(/\r?\n/u);
  const jobsLine = lines.findIndex((line) => /^jobs:\s*$/u.test(line));
  if (jobsLine === -1) {
    return [];
  }

  const blocks = [];
  let current = null;

  for (let index = jobsLine + 1; index < lines.length; index += 1) {
    const line = lines[index];
    const jobMatch = /^  ([A-Za-z0-9_-]+):\s*(?:#.*)?$/u.exec(line);
    const topLevelMatch = /^[A-Za-z0-9_-]+:\s*$/u.test(line);

    if (topLevelMatch) {
      break;
    }

    if (jobMatch) {
      if (current) {
        current.end = index;
        blocks.push(current);
      }

      current = {
        name: jobMatch[1],
        start: index,
        end: lines.length,
        lines: [],
      };
      continue;
    }

    if (current) {
      current.lines.push(line);
    }
  }

  if (current) {
    blocks.push(current);
  }

  return blocks;
}

for (const filePath of readWorkflowFiles()) {
  const relativePath = path.relative(rootDir, filePath).replaceAll(path.sep, "/");
  const content = fs.readFileSync(filePath, "utf8");

  for (const [pattern, message] of forbiddenContent) {
    if (pattern.test(content)) {
      errors.push(`${relativePath}: ${message}`);
    }
  }

  if (!/^permissions:\s*$/mu.test(content)) {
    errors.push(`${relativePath}: workflow-level permissions must be explicit`);
  }

  if (!/^concurrency:\s*$/mu.test(content)) {
    errors.push(`${relativePath}: workflow-level concurrency must be explicit`);
  }

  for (const match of content.matchAll(/^\s*-?\s*uses:\s*([^\s#]+)(?:\s+#.*)?$/gmu)) {
    const spec = match[1];
    if (spec.startsWith("./") || spec.startsWith("docker://")) {
      continue;
    }
    const ref = spec.slice(spec.lastIndexOf("@") + 1);
    if (!/^[0-9a-f]{40}$/iu.test(ref)) {
      errors.push(`${relativePath}: action '${spec}' is not pinned to a full commit SHA`);
    }
  }

  if (
    relativePath.endsWith("mirror-source.yml") ||
    relativePath.endsWith("sync-from-personal.yml")
  ) {
    errors.push(`${relativePath}: personal-to-org workflow sync must be removed`);
  }

  if (content.includes("github.repository_owner")) {
    errors.push(`${relativePath}: use exact github.repository guards, not github.repository_owner`);
  }

  if (content.includes("github.repository == 'oaslananka/mcp-ssh-tool'")) {
    errors.push(`${relativePath}: personal-repo job guard is not allowed`);
  }

  if (content.includes("git remote add source https://github.com/oaslananka/mcp-ssh-tool.git")) {
    errors.push(`${relativePath}: personal-to-org source remote is not allowed in workflows`);
  }

  for (const job of findJobBlocks(content)) {
    const block = job.lines.join("\n");
    const hasGuard = block.includes(requiredGuard);

    if (!hasGuard) {
      errors.push(`${relativePath}: job '${job.name}' is missing exact org repository guard`);
    }

    if (!/^\s+timeout-minutes:\s*\d+\s*$/mu.test(block)) {
      errors.push(`${relativePath}: job '${job.name}' is missing timeout-minutes`);
    }
  }
}

if (errors.length > 0) {
  console.error("Workflow guard validation failed:");
  for (const error of errors) {
    console.error(`  - ${error}`);
  }
  process.exit(1);
}

console.log("Workflow guards are org-only.");

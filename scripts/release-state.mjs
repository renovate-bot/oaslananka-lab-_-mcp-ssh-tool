#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_REPO = "oaslananka-lab/mcp-ssh-tool";
const DEFAULT_PERSONAL_REPO = "oaslananka/mcp-ssh-tool";

function usage() {
  console.log(`Usage: node scripts/release-state.mjs [options]

Options:
  --repo owner/name             Automation GitHub repository. Default: ${DEFAULT_REPO}
  --personal-repo owner/name    Personal source repository. Default: ${DEFAULT_PERSONAL_REPO}
  --offline                     Skip npm, MCP Registry, GitHub, and mirror network checks.
  --json                        Print machine-readable JSON.
  --help                        Show this help.

The script is read-only. It never publishes, creates releases, pushes refs, or
prints secrets.`);
}

function parseArgs(argv) {
  const options = {
    json: false,
    offline: false,
    personalRepo: DEFAULT_PERSONAL_REPO,
    repo: DEFAULT_REPO,
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
      case "--personal-repo":
        options.personalRepo = argv[++index];
        break;
      case "--offline":
        options.offline = true;
        break;
      case "--json":
        options.json = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), "utf8"));
}

function readText(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}

function run(command, args) {
  const executable =
    process.platform === "win32" && command === "gh"
      ? "gh.exe"
      : process.platform === "win32" && command === "git"
        ? "git.exe"
        : command;
  const result = spawnSync(executable, args, {
    cwd: rootDir,
    encoding: "utf8",
    shell: false,
    windowsHide: true,
  });

  return {
    ok: result.status === 0,
    stderr: (result.stderr ?? result.error?.message ?? "").trim(),
    stdout: (result.stdout ?? "").trim(),
  };
}

function detectSourceVersion() {
  const pkg = readJson("package.json");
  const server = readJson("server.json");
  const mcp = readJson("mcp.json");
  const registryMcp = readJson("registry/mcp-ssh-tool/mcp.json");
  const mcpTs = readText("src/mcp.ts");
  const sourceVersion = /export\s+const\s+SERVER_VERSION\s*=\s*["']([^"']+)["']\s*;/u.exec(
    mcpTs,
  )?.[1];

  return {
    mcpJson: mcp.version,
    packageJson: pkg.version,
    registryMcp: registryMcp.version,
    serverJson: server.version,
    sourceVersion,
    serverName: server.name,
    packageName: pkg.name,
  };
}

function allEqual(values) {
  if (values.some((v) => !v)) return false;
  return new Set(values).size === 1;
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "mcp-ssh-tool-release-state",
    },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}

async function inspectNpm(packageName, version, offline) {
  if (offline) {
    return { checked: false, reason: "offline" };
  }

  try {
    const payload = await fetchJson(
      `https://registry.npmjs.org/${encodeURIComponent(packageName)}`,
    );
    return {
      checked: true,
      latest: payload["dist-tags"]?.latest ?? null,
      versionPublished: Boolean(payload.versions?.[version]),
    };
  } catch (error) {
    return { checked: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function inspectMcpRegistry(serverName, version, offline) {
  if (offline) {
    return { checked: false, reason: "offline" };
  }

  try {
    const serverId = encodeURIComponent(serverName);
    const payload = await fetchJson(
      `https://registry.modelcontextprotocol.io/v0.1/servers/${serverId}/versions/latest`,
    );
    const latest = payload.server?.version ?? null;
    const status = payload._meta?.status ?? payload.server?.status ?? null;
    return {
      checked: true,
      latest,
      status,
      versionPublished: latest === version,
    };
  } catch (error) {
    return { checked: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function inspectGit(version, repo, personalRepo, offline, packageName) {
  const tag = `${packageName}-v${version}`;
  const tagCheck = run("git", ["rev-parse", "-q", "--verify", `refs/tags/${tag}`]);
  const head = run("git", ["rev-parse", "HEAD"]);
  const release = offline
    ? { checked: false, reason: "offline" }
    : run("gh", [
        "release",
        "view",
        tag,
        "--repo",
        repo,
        "--json",
        "tagName,url,isDraft,isPrerelease",
      ]);
  const personal = offline
    ? { checked: false, reason: "offline" }
    : run("git", [
        "ls-remote",
        `https://github.com/${personalRepo}.git`,
        "refs/heads/main",
        `refs/tags/${tag}`,
      ]);

  return {
    automationHead: head.ok ? head.stdout : null,
    githubRelease:
      !offline && release.ok
        ? { checked: true, exists: true, payload: JSON.parse(release.stdout) }
        : { checked: !offline, exists: false, error: release.stderr || undefined },
    personalSource:
      !offline && personal.ok
        ? { checked: true, refs: personal.stdout.split(/\r?\n/u).filter(Boolean) }
        : { checked: !offline, error: personal.stderr || undefined },
    tag,
    tagExists: tagCheck.ok,
    tagObject: tagCheck.ok ? tagCheck.stdout : null,
  };
}

function deriveState({ git, mcpRegistry, npmState, versions }) {
  const blockers = [];
  const versionValues = [
    versions.packageJson,
    versions.serverJson,
    versions.mcpJson,
    versions.registryMcp,
    versions.sourceVersion,
  ];

  if (!allEqual(versionValues)) {
    blockers.push("package/server/mcp/registry/source versions drift");
  }

  if (npmState.checked && npmState.versionPublished) {
    blockers.push(`${versions.packageName}@${versions.packageJson} is already published on npm`);
  }

  if (mcpRegistry.checked && mcpRegistry.versionPublished) {
    blockers.push(
      `${versions.serverName}@${versions.packageJson} is already active/latest in the MCP Registry`,
    );
  }

  let currentState = "no-release";
  if (git.tagExists) {
    currentState = "tag-created";
  }
  if (npmState.checked && npmState.versionPublished) {
    currentState = "npm-published";
  }
  if (mcpRegistry.checked && mcpRegistry.versionPublished) {
    currentState = "mcp-registry-updated";
  }
  if (git.githubRelease.exists) {
    currentState = "github-release-published";
  }
  if (
    git.personalSource.checked &&
    git.personalSource.refs.some((ref) => ref.endsWith(`refs/tags/${git.tag}`))
  ) {
    currentState = "personal-source-synced";
  }

  let nextSafeCommand =
    "Merge a Conventional Commit to main and let release-please open or update the release PR.";
  if (!allEqual(versionValues)) {
    nextSafeCommand = "pnpm run sync-version -- --check";
  } else if (!git.tagExists) {
    nextSafeCommand =
      "Wait for release-please to create the release PR; do not create tags manually.";
  } else if (!(npmState.checked && npmState.versionPublished)) {
    nextSafeCommand =
      "Merge the release-please PR and let release.yml publish from release outputs.";
  } else {
    nextSafeCommand = "No publish command is safe or useful for the inspected version.";
  }

  const safeToPublish =
    blockers.length === 0 &&
    git.tagExists &&
    npmState.checked &&
    !npmState.versionPublished &&
    mcpRegistry.checked &&
    !mcpRegistry.versionPublished;

  return {
    blockers,
    currentState,
    nextSafeCommand,
    safe_to_publish: safeToPublish,
  };
}

function renderHuman(result) {
  return [
    `current state: ${result.currentState}`,
    `safe_to_publish: ${result.safe_to_publish}`,
    `package: ${result.versions.packageName}@${result.version}`,
    `MCP server: ${result.versions.serverName}@${result.version}`,
    `tag: ${result.git.tag} (${result.git.tagExists ? "present" : "missing"})`,
    `npm latest: ${result.npm.latest ?? "not checked"}`,
    `MCP Registry latest: ${result.mcpRegistry.latest ?? "not checked"} (${result.mcpRegistry.status ?? "status unknown"})`,
    `GitHub release: ${result.git.githubRelease.exists ? "present" : "not present"}`,
    `blockers: ${result.blockers.length ? result.blockers.join("; ") : "none"}`,
    `next safe command: ${result.nextSafeCommand}`,
  ].join("\n");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const versions = detectSourceVersion();
  const version = versions.packageJson;
  const [npmState, mcpRegistry] = await Promise.all([
    inspectNpm(versions.packageName, version, options.offline),
    inspectMcpRegistry(versions.serverName, version, options.offline),
  ]);
  const git = inspectGit(
    version,
    options.repo,
    options.personalRepo,
    options.offline,
    versions.packageName,
  );
  const derived = deriveState({ git, mcpRegistry, npmState, versions });
  const result = {
    ...derived,
    generatedAt: new Date().toISOString(),
    git,
    mcpRegistry,
    npm: npmState,
    repo: options.repo,
    version,
    versions,
  };

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(renderHuman(result));
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

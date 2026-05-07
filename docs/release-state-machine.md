# Release State Machine

`scripts/release-state.mjs` is a read-only release-state inspector. It does not publish, create releases, push refs, delete refs, or print secrets.

## States

The release control plane tracks these states:

- `no-release`
- `release-pr-open`
- `release-pr-green`
- `release-pr-merged`
- `tag-created`
- `dry-run-success`
- `npm-test-published`
- `npm-published`
- `mcp-registry-updated`
- `docker-ghcr-published`
- `github-release-published`
- `personal-mirror-synced`
- `post-release-smoke-success`

The current script infers local and live state from package metadata, local tags, npm, MCP Registry, GitHub Release, and personal mirror refs. It is intentionally conservative: if a state cannot be proven, it reports the blocker instead of assuming publish safety.

## Inspected Sources

Local metadata:

- `package.json`
- `package-lock.json`
- `server.json`
- `mcp.json`
- `registry/mcp-ssh-tool/mcp.json`
- `src/mcp.ts`

Live and remote surfaces when not run with `--offline`:

- local Git tag `v<version>`
- GitHub Release in `oaslananka-lab/mcp-ssh-tool`
- npm package status
- MCP Registry latest version and status
- personal showcase main/tag refs

## Output Contract

The script prints:

- current state
- blockers
- next safe command
- `safe_to_publish`

`safe_to_publish` is `false` when the version is already published on npm or active/latest in the MCP Registry, metadata drift exists, a required tag is missing, or live state cannot be verified.

## Local Use

```bash
node scripts/release-state.mjs --help
node scripts/release-state.mjs --repo oaslananka-lab/mcp-ssh-tool
node scripts/release-state.mjs --offline --json
```

For this project, live publishing remains manual and approval-gated through `trusted-publish.yml`; agents may run dry-run validation only when explicitly requested.

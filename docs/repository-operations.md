# Repository Operations

## Source And Automation Model

- Source repository: `https://github.com/oaslananka/mcp-ssh-tool`
- Automation repository: `https://github.com/oaslananka-lab/mcp-ssh-tool`
- npm package: `mcp-ssh-tool`
- MCP server name: `io.github.oaslananka/mcp-ssh-tool`

The personal repository is the source repository and local `origin`. The org repository owns GitHub Actions execution, PR verification, security scanning, releases, package publication, registry publication, attestations, SBOMs, and Docker validation. Keep the two repositories synchronized; personal-repo Actions are not required gates.

## Routine Maintainer Commands

```bash
git remote -v
pnpm install --frozen-lockfile
pnpm run check
pnpm audit --audit-level moderate
pnpm pack --dry-run
node scripts/validate-mcp-metadata.mjs
node scripts/validate-chatgpt-app.mjs
node scripts/check-workflow-guards.mjs
bash scripts/run-workflow-lints.sh
```

## PR Verification

Use GitHub as the source of truth:

```bash
gh pr view <PR_NUMBER> --repo oaslananka-lab/mcp-ssh-tool --json number,state,mergeable,isDraft,headRefName,baseRefName,statusCheckRollup
gh run list --repo oaslananka-lab/mcp-ssh-tool --branch <BRANCH_NAME> --limit 30
gh run view <RUN_ID> --repo oaslananka-lab/mcp-ssh-tool --log-failed
```

Do not treat local checks as a substitute for inspecting org GitHub Actions on PR work.

## Security Feature Setup

Enable GitHub Dependency Graph for the org repository when repository settings allow it. The `Dependency Review` job checks the dependency-graph compare endpoint first and skips with an explicit message until GitHub exposes that API for this repository.

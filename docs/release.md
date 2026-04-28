# Release Procedure

The primary release path is the org `trusted-publish.yml` workflow. Releases are human-triggered after local gates and org CI/security checks are green.

## Preparation

1. Confirm `package.json.repository.url` is `git+https://github.com/oaslananka-lab/mcp-ssh-tool.git`.
2. Confirm `package.json#mcpName` matches `server.json#name`.
3. Run local gates:

```bash
task ci
task security:local
```

4. Push the hardening branch to canonical GitHub:

```bash
git push -u github chore/v2.1.0-hardening
```

5. Open a PR against `oaslananka/mcp-ssh-tool`.
6. Sync the branch to `oaslananka-lab/mcp-ssh-tool`.
7. Wait for org CI/security checks to pass.

## Version Commit

Only after org checks are green, create the final release commit:

```bash
npm version 2.1.0 --no-git-tag-version
npm run sync-version
git add package.json package-lock.json mcp.json server.json registry/mcp-ssh-tool/mcp.json src/mcp.ts CHANGELOG.md
git commit -m "chore(release): v2.1.0"
```

The release commit message must be exactly:

```text
chore(release): v2.1.0
```

## Human Publish Trigger

Do not trigger this from an agent:

```bash
gh workflow run trusted-publish.yml \
  --repo oaslananka-lab/mcp-ssh-tool \
  --field version=v2.1.0 \
  --field approval=APPROVE_RELEASE
```

The workflow publishes npm with trusted publishing, publishes MCP Registry metadata with GitHub OIDC, creates the org release, and mirrors release metadata/assets back to canonical GitHub.

## Post-Publish Verification

```bash
npm view mcp-ssh-tool version repository dist-tags --json
npm view mcp-ssh-tool@2.1.0 dist.integrity dist.tarball --json
npx -y mcp-ssh-tool@2.1.0 --version
gh release view v2.1.0 --repo oaslananka-lab/mcp-ssh-tool
gh release view v2.1.0 --repo oaslananka/mcp-ssh-tool
```

Verify the MCP Registry latest endpoint reports `2.1.0`.

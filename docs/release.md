# Release Procedure

The organization repository `https://github.com/oaslananka-lab/mcp-ssh-tool` is the only release authority. The personal repository is a showcase mirror and is not used for release decisions.

## Pre-Release Checks

Run local gates before opening or updating a release PR:

```bash
npm ci
npm run check
npm audit --audit-level=moderate
npm pack --dry-run
node scripts/validate-mcp-metadata.mjs
node scripts/validate-chatgpt-app.mjs
node scripts/check-workflow-guards.mjs
bash scripts/run-workflow-lints.sh
```

If Docker is available:

```bash
docker build -t mcp-ssh-tool:local .
docker run --rm mcp-ssh-tool:local --version
docker run --rm mcp-ssh-tool:local --help
```

## Version Commit

Only after org CI/security checks are green, create the release version commit:

```bash
npm version 2.1.2 --no-git-tag-version
npm run sync-version
git add package.json package-lock.json mcp.json server.json registry/mcp-ssh-tool/mcp.json src/mcp.ts CHANGELOG.md
git commit -m "chore(release): v2.1.2"
```

The MCP server name remains `io.github.oaslananka/mcp-ssh-tool` because the server is already published under that name in the MCP Registry.

## Dry-Run Publish

Agents may run dry-run validation only when asked:

```bash
gh workflow run trusted-publish.yml \
  --repo oaslananka-lab/mcp-ssh-tool \
  --field version=v2.1.2 \
  --field publish=false \
  --field approval=DRY_RUN
```

This does not authenticate to npm, does not publish to npm, does not publish MCP Registry metadata, and does not create a GitHub Release.

## Human Live Publish

Do not trigger this from an agent unless the user explicitly requests live publishing:

```bash
gh workflow run trusted-publish.yml \
  --repo oaslananka-lab/mcp-ssh-tool \
  --field version=v2.1.2 \
  --field publish=true \
  --field approval=APPROVE_RELEASE
```

The live job is guarded by:

- org repository check
- manual dispatch only
- `publish=true`
- exact approval phrase
- `npm-production` environment approval, kept for compatibility with existing npm trusted publisher configuration
- npm already-published check
- MCP Registry already-published check
- post-publish npm and MCP Registry verification

If npm trusted publishing is reconfigured to use the `release` environment instead of `npm-production`, update the workflow and this document in the same PR.

## Post-Publish Verification

```bash
npm view mcp-ssh-tool version repository homepage bugs dist-tags --json
npm view mcp-ssh-tool@2.1.2 dist.integrity dist.tarball --json
npx -y mcp-ssh-tool@2.1.2 --version
gh release view v2.1.2 --repo oaslananka-lab/mcp-ssh-tool
curl -fsSL "https://registry.modelcontextprotocol.io/v0.1/servers/io.github.oaslananka%2Fmcp-ssh-tool/versions/latest"
```

Verify:

- npm latest is the intended version
- npm provenance is present for trusted-published public releases
- `server.version` in the MCP Registry latest response is the intended version
- registry `_meta.status` is `active`
- GitHub Release assets include the npm tarball, SBOM, and SHA256 files
- GitHub artifact attestations verify against `oaslananka-lab/mcp-ssh-tool`

## Rollback and Emergency Fallback

`publish.yml` exists only for emergency token fallback when npm trusted publishing is unavailable. It remains manual, approval-gated, Doppler-backed, and org-only. Prefer fixing trusted publishing over using fallback tokens.

Do not unpublish npm packages except within npm's policy window and only after maintainer approval. Prefer deprecation plus a patched release.

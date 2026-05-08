# Release Procedure

The personal repository `https://github.com/oaslananka/mcp-ssh-tool` is the source repository. The organization repository `https://github.com/oaslananka-lab/mcp-ssh-tool` is the only release authority because GitHub Actions, attestations, and trusted publish checks run there.

## Pre-Release Checks

Run local gates before merging release-relevant changes:

```bash
pnpm install --frozen-lockfile
pnpm run check
pnpm audit --audit-level moderate
pnpm pack --dry-run
node scripts/validate-mcp-metadata.mjs
node scripts/validate-chatgpt-app.mjs
node scripts/release-state.mjs --offline
node scripts/check-workflow-guards.mjs
bash scripts/run-workflow-lints.sh
```

If Docker is available:

```bash
docker build -t mcp-ssh-tool:local .
docker run --rm mcp-ssh-tool:local --version
docker run --rm mcp-ssh-tool:local --help
```

## Release Automation

Releases use release-please manifest mode:

- `release-please-config.json` defines the Node package and extra version files.
- `.release-please-manifest.json` stores the current released version.
- Conventional Commit history determines the next version.
- The release workflow runs on merges to `main`.
- Release asset and publish jobs run only when release-please reports `release_created == 'true'`.
- npm publish and npm package verification run only when repository variable `AUTO_RELEASE_PUBLISH` is set to `true`; otherwise, the release workflow still creates the GitHub Release assets, checksums, SBOM, and attestations and records an explicit publish skip.

Do not create tags manually, edit `CHANGELOG.md` by hand, or bump package versions outside a release-please PR.

## Release Flow

1. Merge a Conventional Commit to `main`.
2. Let `release.yml` open or update the release-please PR.
3. Review the generated changelog and version updates.
4. Merge the release-please PR after CI is green.
5. Let `release.yml` create the GitHub Release, package tarball, CycloneDX SBOM, SHA256 checksum files, and artifact attestations; npm trusted publish and verification occur only when `AUTO_RELEASE_PUBLISH=true`.

The MCP server name remains `io.github.oaslananka/mcp-ssh-tool` because the server is already published under that name in the MCP Registry.

## Post-Publish Verification

```bash
npm view mcp-ssh-tool version repository homepage bugs dist-tags --json
npm view mcp-ssh-tool@<version> dist.integrity dist.tarball --json
npx -y mcp-ssh-tool@<version> --version
gh release view <package-name>-v<version> --repo oaslananka-lab/mcp-ssh-tool
curl -fsSL "https://registry.modelcontextprotocol.io/v0.1/servers/io.github.oaslananka%2Fmcp-ssh-tool/versions/latest"
```

Verify:

- npm latest is the intended version
- npm provenance is present for trusted-published public releases
- GitHub Release assets include the npm tarball, SBOM, and SHA256 files
- GitHub artifact attestations verify against `oaslananka-lab/mcp-ssh-tool`

## Rollback

Do not unpublish npm packages except within npm policy windows and only after maintainer approval. Prefer deprecation plus a patched release.

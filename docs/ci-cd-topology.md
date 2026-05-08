# CI/CD Topology

`mcp-ssh-tool` uses a split repository model with one operational source of truth.

## Repository Roles

| Repository | Role | Automation |
|------------|------|------------|
| `https://github.com/oaslananka-lab/mcp-ssh-tool` | Canonical source, PR target, CI/CD boundary, security boundary, release authority | All required workflow jobs are guarded by `github.repository == 'oaslananka-lab/mcp-ssh-tool'`. |
| `https://github.com/oaslananka/mcp-ssh-tool` | Personal showcase mirror | No publish authority. It receives `main` and `v*.*.*` tags only through the manual `mirror-personal.yml` workflow. |
| Azure DevOps | Optional backup validation record | Manual-only; not part of npm, MCP Registry, GitHub Release, or container publish authority. |

If repository state conflicts, the org repository wins.

## Workflow Boundary

| Workflow | Purpose |
|----------|---------|
| `meta.yml` | Workflow guard checks, actionlint/zizmor, MCP metadata validation, and ChatGPT app readiness validation. |
| `ci.yml` | Format, lint, typecheck, audit, license, unit coverage, integration tests, build, SBOM, pack validation, and Docker smoke. |
| `security.yml` | CodeQL, dependency review, Scorecard, Gitleaks, Hadolint, Trivy, Zizmor, OSV, and Doppler safety validation. |
| `release.yml` | Release-please manifest mode, release asset generation, attestations, and npm trusted publishing. |
| `docker.yml` | Docker image build/smoke on PRs and pushes; GHCR publish only from semver tag pushes. |
| `mirror-personal.yml` | Manual org-to-personal showcase mirror. Defaults to dry-run. |
| `branch-hygiene.yml` | Monthly stale branch report. |

The removed `sync-from-canonical.yml` workflow used the obsolete personal-to-org direction and must not be restored.

## Required GitHub Secrets

| Secret | Required by | Purpose |
|--------|-------------|---------|
| `DOPPLER_TOKEN` | safety workflows | Bootstrap Doppler for workflow-only runtime secrets. |
| `PERSONAL_REPO_PUSH_TOKEN` | `mirror-personal.yml` | Push `main` and `v*.*.*` tags from org to the personal showcase mirror. |
| `CODECOV_TOKEN` | optional via Doppler | Coverage upload when configured. |
| `NPM_TOKEN` | unused for normal release | Trusted publishing uses OIDC and npm package settings instead of tokens. |
| `MCP_REGISTRY_TOKEN` | only if current registry auth changes | Not used by the current GitHub-token MCP Registry flow. |
| `DOCKERHUB_USERNAME` / `DOCKERHUB_TOKEN` | not currently used | Reserved only if Docker Hub support is explicitly enabled later. |

Do not commit `.npmrc` tokens or print secrets in workflow logs.

## Required GitHub Variables

| Variable | Expected value |
|----------|----------------|
| `AUTO_RELEASE_PUBLISH` | `false` |
| `AUTO_RELEASE_TARGET` | `dry-run` |
| `NPM_PACKAGE_NAME` | `mcp-ssh-tool` |
| `MCP_SERVER_NAME` | `io.github.oaslananka/mcp-ssh-tool` |
| `CHATGPT_APP_PUBLISH` | `false` |

## Environments

| Environment | Use |
|-------------|-----|
| `npm-production` | Kept for the primary npm trusted-publishing workflow because npm trusted publisher configuration can bind to the exact GitHub environment name. Migrate to `release` only after updating npm package settings. |
| `release` | General release review environment for future consolidation and non-npm release jobs. |

## Release Boundary

`release.yml` runs on merges to `main`. It first runs release-please in manifest mode. If no release is created, asset and publish jobs are skipped. When a release is created, downstream jobs use only release-please outputs for the tag and version.

The release asset job runs `pnpm run check`, creates the package tarball, CycloneDX SBOM, SHA256 checksum files, artifact attestations, GitHub Release assets, npm trusted publish, and npm verification. Tags and changelog updates are created by release-please, never by local commands.

## Showcase Mirror

`mirror-personal.yml` pushes org `main` and exact semver tags matching `v*.*.*` to `https://github.com/oaslananka/mcp-ssh-tool`. It does not mirror PR branches, release branches, issues, or GitHub Releases. `dry_run=true` is the default, and force push requires `force_mirror=true`.

Operators must not create release tags or edit changelog/version files manually.

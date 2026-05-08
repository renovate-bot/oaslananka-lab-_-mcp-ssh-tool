# CI/CD Topology

`mcp-ssh-tool` uses a split repository model: the personal repository is the source repository, and the organization repository is the GitHub Actions, release, and security boundary.

## Repository Roles

| Repository | Role | Automation |
|------------|------|------------|
| `https://github.com/oaslananka/mcp-ssh-tool` | Source repository and local `origin` | GitHub Actions are intentionally disabled here; do not use personal-repo Actions as release or required-check gates. |
| `https://github.com/oaslananka-lab/mcp-ssh-tool` | CI/CD, PR verification, security scanning, release, provenance, and publish boundary | All required workflow jobs are guarded by `github.repository == 'oaslananka-lab/mcp-ssh-tool'`. |
| Azure DevOps | Optional backup validation record | Manual-only; not part of npm, MCP Registry, GitHub Release, or container publish authority. |

The two GitHub repositories must stay content-identical for `main`, release tags, releases, labels, milestones, and active collaboration state. If refs diverge, audit both sides first and fast-forward the stale side to the latest reviewed or released commit. Do not force-rewrite either repository without an exact ref plan and `--force-with-lease`.

## Workflow Boundary

| Workflow | Purpose |
|----------|---------|
| `meta.yml` | Workflow guard checks, actionlint/zizmor, MCP metadata validation, and ChatGPT app readiness validation. |
| `ci.yml` | Format, lint, typecheck, audit, license, unit coverage, integration tests, build, SBOM, pack validation, and Docker smoke. |
| `security.yml` | CodeQL, dependency review, Scorecard, Gitleaks, Hadolint, Trivy, Zizmor, OSV, and Doppler safety validation. |
| `release.yml` | Release-please manifest mode, release asset generation, attestations, and npm trusted publishing. |
| `docker.yml` | Docker image build/smoke on PRs and pushes; GHCR publish only from semver tag pushes. |
| `mirror-personal.yml` | Org-to-personal source backfill for release-generated `main` and release tag refs. Manual runs default to dry-run. |
| `branch-hygiene.yml` | Monthly stale branch report. |

Do not run required CI/CD in the personal repository. Promote the same branch content to the org repository for verification, then backfill org release results to the personal source repository.

## Required GitHub Secrets

| Secret | Required by | Purpose |
|--------|-------------|---------|
| `DOPPLER_TOKEN` | safety workflows | Bootstrap Doppler for workflow-only runtime secrets. |
| `PERSONAL_REPO_PUSH_TOKEN` | `mirror-personal.yml` | Push `main`, `v*.*.*`, and `<package-name>-v*` release tags from org automation back to the personal source repository. |
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

## Repository Equality

`mirror-personal.yml` pushes org `main`, exact semver tags matching `v*.*.*`, and release-please package tags matching `<package-name>-v*` to `https://github.com/oaslananka/mcp-ssh-tool`. It does not delete refs automatically. `dry_run=true` is the default for manual runs, and force push requires `force_mirror=true`, approval text, and `--force-with-lease`.

Operators must not create release tags or edit changelog/version files manually.

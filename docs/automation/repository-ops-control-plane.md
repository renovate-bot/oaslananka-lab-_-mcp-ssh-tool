# Repository Operations Control Plane

Source history lives in `https://github.com/oaslananka/mcp-ssh-tool`.
GitHub Actions, release, security scanning, and publish authority live in `https://github.com/oaslananka-lab/mcp-ssh-tool`.

## Current Workflow Inventory

Critical path workflows:

- `meta.yml`: cheap workflow guard, actionlint/zizmor, version and metadata validation.
- `review-thread-gate.yml`: unresolved review-thread gate and PR readiness labels.
- `ci.yml`: format, lint, typecheck, audit, license, coverage, package, integration, Docker smoke.
- `security.yml`: CodeQL, dependency review, Gitleaks, Hadolint, Trivy, Zizmor, OSV, Doppler safety checks.

Release workflows:

- `release.yml`: release-please manifest mode, GitHub Release assets, npm trusted publishing, SBOMs, checksums, and attestations.
- `docker.yml`: PR Docker smoke and semver tag-gated GHCR publish.

Advisory and maintenance workflows:

- `mirror-personal.yml`: org-to-personal `main`, `v*.*.*`, and `mcp-ssh-tool-v*` release tag backfill.
- `actions-maintenance.yml`: manual run classification, safe reruns, and superseded-run cleanup.

## Gate Classes

Blocking correctness gates:

- formatting, lint, typecheck, unit tests, build, package content validation
- MCP metadata consistency and version synchronization
- workflow syntax, actionlint, zizmor, and org-only workflow guard checks
- secret scanning
- SSH policy, strict host-key, destructive command, traversal, and HTTP auth/origin tests

Advisory gates:

- Scorecard
- docs links and docs generation
- optional Docker smoke
- optional integration/e2e
- ChatGPT app readiness validator while publishing remains unconfigured
- personal source backfill

Release authority gates:

- release-please manifest mode
- release-please release PR merge
- release-created output gate
- npm trusted publishing and provenance checks
- package tarball, SBOM, SHA256SUMS, and artifact attestations
- post-publish npm smoke checks

Review feedback gates:

- unresolved human review threads
- GitHub suggestion blocks

## Draft-First CI Model

Draft PRs run cheap control-plane checks only:

- `review-thread-gate.yml`
- `meta.yml`
- `security.yml` jobs that remain cheap and security-critical, including Gitleaks and Zizmor

Heavy jobs in `ci.yml`, `docker.yml`, and expensive `security.yml` jobs are guarded with:

```yaml
if: github.event_name != 'pull_request' || github.event.pull_request.draft == false
```

Push-to-main, tag, merge queue, schedule, and manual workflows are not skipped by draft status.

## Path-Aware Cost Strategy

Cheap gates should run first for every PR. Heavy gates should run after cheap success or when the PR is ready for review.

Recommended routing:

- docs-only: metadata, docs generation when relevant, review-thread gate
- workflow-only: workflow guard, actionlint, zizmor, review-thread gate
- source changes: format, lint, typecheck, unit tests, coverage after ready
- tests-only: lint, typecheck, targeted tests, coverage after ready
- MCP metadata changes: `sync-version --check`, `validate:mcp-metadata`, package preflight
- release/npm/MCP Registry changes: metadata validators, package pack check, release state, and release-please config validation
- Docker-only changes: Hadolint and Docker smoke after ready
- ChatGPT app-only changes: `validate:chatgpt-app`, app security docs
- SSH policy/security changes: targeted SSH policy and HTTP auth/origin tests, then full coverage after ready

## Failure Classes

`scripts/classify-gh-failure.mjs` maps failed logs into repository-specific classes and marks whether an automatic fix is allowed, whether human approval is required, and whether release/publish must stop.

Release identity, npm/MCP Registry auth, environment protection, permissions broadening, SSH safety weakening, HTTP auth/origin weakening, destructive mirror repair, package name changes, and MCP server name changes require human review.

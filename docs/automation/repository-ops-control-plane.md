# Repository Operations Control Plane

This repository is operated from `https://github.com/oaslananka-lab/mcp-ssh-tool`.
`https://github.com/oaslananka/mcp-ssh-tool` is a showcase mirror only and is never a release authority.

## Current Workflow Inventory

Critical path workflows:

- `meta.yml`: cheap workflow guard, actionlint/zizmor, version and metadata validation.
- `review-thread-gate.yml`: unresolved review-thread gate and PR readiness labels.
- `ci.yml`: format, lint, typecheck, audit, license, coverage, package, integration, Docker smoke.
- `security.yml`: CodeQL, dependency review, Gitleaks, Hadolint, Trivy, Zizmor, OSV, Doppler safety checks.

Release workflows:

- `trusted-publish.yml`: manual trusted-publishing release path for npm, MCP Registry, attestations, and GitHub Release.
- `publish.yml`: manual emergency token fallback only.
- `docker.yml`: PR Docker smoke and manual/tag-gated GHCR publish.

Advisory and maintenance workflows:

- `mirror-personal.yml`: org-to-personal main and `v*.*.*` tag mirror.
- `jules-ci-autofix.yml`: guarded Jules maintenance for CI failures, dependencies, and approved issues.
- `agent-review-fix-loop.yml`: guarded Jules repair loop for actionable review threads.
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
- personal showcase mirror

Release authority gates:

- manual workflow dispatch
- explicit approval input
- `npm-production` environment approval while npm trusted publishing remains configured there
- version/tag consistency
- npm already-published and provenance/trusted-publishing checks
- MCP Registry dry-run payload validation and already-published checks
- package tarball, SBOM, SHA256SUMS, and artifact attestations
- post-publish npm and MCP Registry smoke checks

Bot and agent feedback gates:

- unresolved human review threads
- actionable bot review threads
- Sentry, Gemini, Jules, Codex, or other bot comments with security/correctness/release wording
- GitHub suggestion blocks
- maintainer `/agent-review-fix` comments or `agent:fix-review` labels

## Draft-First CI Model

Agent-created PRs start as draft. Draft PRs run cheap control-plane checks only:

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
- release/npm/MCP Registry changes: metadata validators, package pack check, release state, dry-run release only by maintainer request
- Docker-only changes: Hadolint and Docker smoke after ready
- ChatGPT app-only changes: `validate:chatgpt-app`, app security docs
- SSH policy/security changes: targeted SSH policy and HTTP auth/origin tests, then full coverage after ready

## Failure Classes

`scripts/classify-gh-failure.mjs` maps failed logs into repository-specific classes and marks whether an automatic fix is allowed, whether human approval is required, and whether release/publish must stop.

Auto-remediation is limited to formatting, lint, metadata drift, version sync drift, docs link drift, safe fixture expectation updates, and workflow upload-folder mistakes. Release identity, npm/MCP Registry auth, environment protection, permissions broadening, SSH safety weakening, HTTP auth/origin weakening, destructive mirror repair, package name changes, and MCP server name changes require human review.

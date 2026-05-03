# CI/CD Topology

`mcp-ssh-tool` uses a split repository model: the personal repository is canonical source, while the organization repository is the only automation and release boundary.

## Repository Roles

| Repository | Role | Automation |
|------------|------|------------|
| `https://github.com/oaslananka/mcp-ssh-tool` | Canonical source and PR target | GitHub Actions disabled after one-time repository setting change. |
| `https://github.com/oaslananka-lab/mcp-ssh-tool` | CI/CD, security scanning, trusted npm publish, MCP Registry publish | All workflow jobs are guarded by `github.repository == 'oaslananka-lab/mcp-ssh-tool'`. |
| Azure DevOps | Optional backup validation record | Manual-only; not part of the trusted publish path. |

The org repository pulls source from canonical with `.github/workflows/sync-from-canonical.yml`. The old personal-repo push mirror workflow was removed to avoid accidental personal-repo automation.

## One-Time Personal Repo Action Disable

Do not run this automatically from an agent. A maintainer should run it once after reviewing the org sync path:

```bash
gh api \
  --method PUT \
  repos/oaslananka/mcp-ssh-tool/actions/permissions \
  -f enabled=false
```

## Required GitHub Secrets

GitHub stores only one project secret:

| Repository | Secret | Purpose |
|------------|--------|---------|
| `oaslananka-lab/mcp-ssh-tool` | `DOPPLER_TOKEN` | Bootstrap Doppler for workflow-only runtime secrets. |

GitHub-provided `GITHUB_TOKEN` is used for same-repository checkout, release creation, SARIF upload, and branch sync. Do not add `NPM_TOKEN`, `CODECOV_TOKEN`, `SAFETY_API_KEY`, or service account tokens directly to GitHub secrets.

## Doppler Secrets

Doppler must contain the inventory tracked in `.doppler/secrets.txt`:

| Secret | Used by |
|--------|---------|
| `CODECOV_TOKEN` | Coverage upload from the org CI workflow. |
| `DOPPLER_GITHUB_SERVICE_TOKEN` | Release-back mirroring from the org release to canonical GitHub. |
| `NPM_TOKEN` | Emergency token publish fallback only. |
| `SAFETY_API_KEY` | Safety service integration and secret-injection validation. |

Use `bash scripts/verify-doppler-secrets.sh` or `powershell -ExecutionPolicy Bypass -File scripts/verify-doppler-secrets.ps1` to verify the inventory.

## Workflows

| Workflow | Purpose |
|----------|---------|
| `meta.yml` | Fast workflow guard, actionlint/zizmor, and metadata checks. |
| `ci.yml` | Format, lint, typecheck, audit, license, unit coverage, integration, build, SBOM, and pack checks. |
| `security.yml` | CodeQL, dependency review, Scorecard, Gitleaks, Hadolint, Trivy, Zizmor, OSV, and Doppler Safety token validation. |
| `sync-from-canonical.yml` | Manual org pull from `oaslananka/mcp-ssh-tool`. |
| `trusted-publish.yml` | Primary human-triggered release path using npm trusted publishing and Doppler-injected canonical GitHub token for MCP Registry namespace ownership. |
| `publish.yml` | Org-only emergency token publish fallback using `NPM_TOKEN` from Doppler. |
| `branch-hygiene.yml` | Monthly stale branch report. |

Required-check workflows include `merge_group` so merge queue checks run on the exact commit group that will merge.

## Release Boundary

The primary publish path is `trusted-publish.yml` in `oaslananka-lab/mcp-ssh-tool`. It verifies quality, builds the package, generates a CycloneDX SBOM, attests artifacts, publishes to npm with trusted publishing, publishes MCP Registry metadata, creates the org GitHub Release, and mirrors release metadata/assets back to canonical GitHub.

The final human trigger is:

```bash
gh workflow run trusted-publish.yml \
  --repo oaslananka-lab/mcp-ssh-tool \
  --field version=v2.1.0 \
  --field approval=APPROVE_RELEASE
```

Agents must not push tags, rotate secrets, merge protected branches, disable Actions, or trigger the final publish workflow.

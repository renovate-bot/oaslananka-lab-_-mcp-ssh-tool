# Branch Protection

Protect `main` in `oaslananka-lab/mcp-ssh-tool` with the org workflows as required checks.

## Required Checks

- `Fast Lint and Metadata / Workflow and Metadata Lint`
- `CI / Quality Gates`
- `CI / Unit Tests (Node 22)`
- `CI / Unit Tests (Node 24)`
- `CI / SSH Integration`
- `CI / Build, SBOM, and Pack`
- `CI / Docker Smoke`
- `Docker / Build and smoke image`
- `Security / CodeQL`
- `Security / OpenSSF Scorecard`
- `Security / Gitleaks`
- `Security / Hadolint`
- `Security / Trivy`
- `Security / Zizmor`
- `Security / OSV Scanner`

Enable merge queue if it is used by the repository. Required-check workflows include `merge_group`, so checks run on merge queue groups before merge.

## Release Controls

- Require review before merging to `main`.
- Require linear history unless the repository intentionally uses merge commits for release notes.
- Restrict who can approve the `npm-production` environment.
- Do not allow bypass for the final publish workflow except repository administrators.

## Source And Automation Boundary

The personal repository `oaslananka/mcp-ssh-tool` is the source repository and local `origin`. GitHub Actions are intentionally disabled there. The organization repository `oaslananka-lab/mcp-ssh-tool` is the CI/CD, release, security-scan, and required-check boundary; do not require personal-repo Actions as branch protection or release gates.

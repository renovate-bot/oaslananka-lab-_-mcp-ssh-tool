# Maintenance Policy

## Ownership

The maintainer owns releases, branch protection, Doppler secret inventory, npm trusted publishing, and MCP Registry metadata. Automation runs from `oaslananka-lab/mcp-ssh-tool`; canonical source remains `oaslananka/mcp-ssh-tool`.

## Cadence

- Weekly: review Renovate PRs and Dependabot security alerts.
- Weekly: review CI/security workflow failures.
- Monthly: review the branch hygiene report.
- Before each release: run local gates, verify org CI/security, and confirm MCP Registry metadata.

## Dependency Automation

Renovate is the version update mechanism and extends `config:best-practices`. Dependabot version PRs are disabled with `open-pull-requests-limit: 0`; Dependabot remains present for GitHub security alert integration.

`@modelcontextprotocol/sdk` updates require manual review and should not be automerged.

## SLA

| Item | Target |
|------|--------|
| Critical security advisory | Triage within 1 business day. |
| High severity dependency alert | Triage within 3 business days. |
| Broken release workflow | Triage before the next release attempt. |
| MCP Registry drift | Triage before claiming registry freshness in docs or release notes. |

## Release Freeze

During release preparation, avoid runtime API changes unless they fix a release-blocking defect. CI/CD, docs, registry metadata, and dependency automation may continue as release hardening work.

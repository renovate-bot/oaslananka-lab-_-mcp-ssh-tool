# Bot and Agent Automation Policy

Automation in this repository exists to reduce maintenance load without transferring release authority away from maintainers.

## May Auto-Fix

Agents may apply narrow fixes for:

- formatting
- trivial lint failures
- MCP metadata drift
- version synchronization drift
- changelog or release-note formatting noise
- workflow artifact upload folder mistakes
- documentation link drift
- test fixture expectation updates when the failing behavior is clear

The agent must run targeted checks and leave a summary of changes and tests.

## Requires Human Review

Agents may not auto-fix or enable these areas without maintainer review:

- npm trusted publisher or token configuration
- MCP Registry publisher/auth configuration
- ChatGPT app publishing credentials or dashboard setup
- GitHub environment protection
- branch protection, merge queue, or repository rulesets
- permissions broadening
- disabling checks
- removing tests
- npm package name changes
- MCP server name changes
- SSH security policy weakening
- HTTP bearer auth or allowed-origin weakening
- destructive mirror force repair
- release or publish workflow behavior that enables production publish

## Hard Stops

Automation must stop and label or report human review needs when it sees:

- secrets, credentials, private keys, bearer tokens, or command-output secrets
- CodeQL, Gitleaks, Trivy, SSH policy, or HTTP auth/origin failures
- npm trusted publishing identity mismatch
- MCP Registry authentication mismatch
- divergent personal showcase tags
- branch protection, environment, or ruleset changes

## Publish Boundary

Agents must not trigger:

- npm publish
- MCP Registry publish
- GHCR production publish
- production GitHub Release creation
- ChatGPT app publish
- secret rotation
- unconditional auto-approve
- unconditional auto-merge

Dry-run release validation is allowed only when explicitly requested by a maintainer and must use `publish=false`.

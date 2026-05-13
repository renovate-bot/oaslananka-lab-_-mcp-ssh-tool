# Threat Model

`mcp-ssh-tool` allows MCP clients to operate remote SSH sessions. The main risks are unauthorized host access, unsafe command execution, credential exposure, artifact tampering, and release identity drift.

## Assets

- SSH credentials and host keys
- Remote host files and services
- MCP tool inputs and outputs
- Audit logs and metrics
- npm package artifacts
- MCP Registry metadata
- GitHub release assets
- Doppler-managed secrets

## Threats And Controls

| Threat | Control |
|--------|---------|
| Host impersonation | Strict host-key verification by default; allow explicit pinned host keys. |
| Privileged command misuse | Root login denied by default; raw `proc_sudo` policy-gated; prefer `ensure_*` tools. |
| Destructive operations | Command and filesystem mutation gates; `policyMode: "explain"` for planning. |
| Secret leakage | Redacted logs; Doppler-first workflow secrets; GitHub stores only `DOPPLER_TOKEN`. |
| Supply-chain tampering | Org-only CI, npm trusted publishing, artifact attestations, SBOM artifacts, CodeQL, Scorecard, Gitleaks, Trivy, Hadolint, Zizmor, OSV, and dependency review. |
| Registry drift | Release workflow publishes MCP Registry metadata after npm publication and post-publish verification checks the latest endpoint. |
| Repository identity drift | `package.json.repository.url` stays aligned with `oaslananka-lab/mcp-ssh-tool` for npm provenance. |

## Out Of Scope

The server cannot secure a compromised target host, a compromised local MCP client, or credentials supplied by a user outside the policy model. Operators are responsible for SSH account lifecycle, host patching, and least-privilege remote accounts.

# SSH Threat Model

## Protected Assets

- SSH credentials and private keys
- host-key trust decisions
- command output and remote file content
- policy files
- audit logs
- local filesystem paths used for transfer

## Controls

- `hostKeyPolicy=strict` by default
- root login denied unless policy allows it
- raw `proc_sudo` denied unless policy allows it
- destructive commands denied unless policy allows them
- destructive filesystem operations policy-controlled
- path allow/deny prefixes for remote and local operations
- SFTP preferred for file transfer with checksum verification
- command timeout and session TTL controls
- rate limiting for MCP tool calls
- audit records for policy decisions
- redaction for secrets in logs and outputs

## High-Risk Areas

| Area | Risk | Expected posture |
|------|------|------------------|
| host-key policy | machine-in-the-middle | strict default, insecure mode documented as exceptional |
| command execution | command injection/destructive changes | schema validation plus policy engine |
| sudo | privilege escalation | raw sudo denied by default |
| file transfer | local path traversal or secret copy | local path allowlist and denylist |
| remote file operations | destructive or protected path writes | path policy and explain mode |
| tunnels | unintended exposure | explicit tunnel tools and audit |
| HTTP transport | remote unauthenticated control | non-loopback refusal without bearer auth and origins |
| logs | secret disclosure | redaction and no raw token printing |

Tests must cover policy denial, host allowlists, destructive operation controls, path traversal, token redaction, and HTTP startup rejection.

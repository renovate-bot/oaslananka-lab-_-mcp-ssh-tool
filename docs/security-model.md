# Security Model

`mcp-ssh-tool` is a privileged remote automation server. It cannot sandbox a user who has valid SSH credentials, so v2 focuses on secure defaults, explicit policy, auditability, and clear trust boundaries.

## Trust Boundaries

- The MCP client is a privileged operator once it can call this server.
- The local machine running the server can access SSH keys, agent sockets, policy files, and logs.
- Remote hosts enforce their own SSH, sudo, filesystem, package, and service permissions.
- HTTP transport is a remote attack surface and must be authenticated.

## v2 Defaults

- Host key verification is `strict`.
- Root SSH login is denied.
- Raw `proc_sudo` is denied.
- Destructive commands are denied by safety policy.
- Destructive filesystem operations are limited to configured prefixes.
- HTTP binds to `127.0.0.1`.
- Legacy SSE endpoints are disabled.
- Logs are redacted before serialization.

## Host Keys

Use `SSH_MCP_HOST_KEY_POLICY`:

- `strict`: verify against `known_hosts`.
- `accept-new`: process-local trust-on-first-use for development and labs.
- `insecure`: disables host-key verification and should not be used in production.

For high-assurance sessions, pass `expectedHostKeySha256` to `ssh_open_session`. This pins a specific SHA-256 fingerprint for that connection.

Deprecated boolean aliases are still accepted for v2 compatibility, but new deployments should use `hostKeyPolicy`.

## Policy Layer

All mutating or privilege-sensitive handlers call the central policy engine. Policy can restrict:

- hosts
- root login
- raw sudo
- command allow/deny regexes
- destructive command patterns
- path allow/deny prefixes
- destructive filesystem operations
- local transfer path allow/deny prefixes for MCP-server-host files used by `file_upload` and `file_download`

Use `policyMode: "explain"` to get a policy verdict without executing. This is the recommended AI-client pattern before configuration changes, deletes, sudo, package removal, service restart/stop, transfers, and tunnels.

## Sudo Boundary

Production mode does not accept sudo passwords through MCP tool inputs. Privileged workflows use non-interactive `sudo -n` and should be backed by restricted NOPASSWD sudoers rules for the exact package, service, file move, or patch commands that policy allows. Passwords must not be placed in shell strings, arguments, logs, audit events, telemetry, stdout, stderr, or error messages.

## Audit And Observability

The server exposes:

- `mcp-ssh-tool://policy/effective`
- `mcp-ssh-tool://audit/recent`
- `mcp-ssh-tool://metrics/json`
- `mcp-ssh-tool://metrics/prometheus`

Metrics include sessions, command timing/failures, file bytes, transfer bytes, tunnel lifecycle, auth failures, and policy denials. Logs redact secrets such as passwords, private keys, passphrases, tokens, authorization headers, and agent paths.

## Recommended Production Posture

- Run stdio for local desktop use.
- Use Streamable HTTP only behind bearer auth and origin validation.
- Keep HTTP on loopback behind an authenticated reverse proxy whenever possible.
- Store policy in `SSH_MCP_POLICY_FILE`.
- Keep `allowRawSudo=false`; prefer `ensure_*` tools.
- Require non-root SSH users and grant narrow sudo rules on the host.
- Pin host fingerprints for sensitive hosts.
- Export JSON logs and Prometheus metrics to a secured destination.
- Review `mcp-ssh-tool://audit/recent` during incident response.

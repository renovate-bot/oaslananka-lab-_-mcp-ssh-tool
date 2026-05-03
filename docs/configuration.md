# Configuration

Configuration comes from built-in v2 defaults, `SSH_MCP_POLICY_FILE`, environment variables, and per-request tool arguments. Per-request values win over environment values. Environment values win over defaults.

## Runtime

| Variable | Default | Description |
|----------|---------|-------------|
| `LOG_LEVEL` | `info` | `error`, `warn`, `info`, or `debug`. |
| `LOG_FORMAT` | `plain` | Use `json` for log shippers. |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | unset | Enables OpenTelemetry trace export. |
| `OTEL_SERVICE_NAME` | `mcp-ssh-tool` | Service name for traces. |
| `SSH_MCP_MAX_SESSIONS` | `20` | Max in-memory sessions. |
| `SSH_MCP_SESSION_TTL` | `900000` | Default session TTL in milliseconds. |
| `SSH_MCP_COMMAND_TIMEOUT` | `30000` | Default process/stream timeout. |
| `SSH_MCP_MAX_FILE_SIZE` | `10485760` | Max bytes for `fs_read`. |
| `SSH_MCP_RATE_LIMIT` | `true` | Enables global tool-call rate limiting. |
| `SSH_MCP_RATE_LIMIT_MAX` | `100` | Max requests in the rate-limit window. |
| `SSH_MCP_RATE_LIMIT_WINDOW_MS` | `60000` | Rate-limit window. |

## SSH Security

| Variable | Default | Description |
|----------|---------|-------------|
| `SSH_MCP_HOST_KEY_POLICY` | `strict` | `strict`, `accept-new`, or `insecure`. |
| `SSH_MCP_KNOWN_HOSTS_PATH` | `~/.ssh/known_hosts` | Known-hosts file for strict verification. |
| `KNOWN_HOSTS_PATH` | unset | Compatibility alias for known-hosts path. |
| `STRICT_HOST_KEY_CHECKING` | unset | Deprecated boolean alias. `true` maps to `strict`; `false` maps to `insecure`. |
| `SSH_MCP_STRICT_HOST_KEY` | unset | Deprecated boolean alias. |
| `SSH_DEFAULT_KEY_DIR` | `~/.ssh` | Directory searched for `id_ed25519`, `id_rsa`, and `id_ecdsa`. |
| `SSH_MCP_ALLOW_ROOT_LOGIN` | `false` | Allows SSH sessions as `root` when explicitly enabled. |
| `SSH_MCP_ALLOWED_CIPHERS` | unset | Optional comma-separated SSH cipher allow-list. |

## Policy

`SSH_MCP_POLICY_FILE` is the canonical policy source. Environment variables are useful for simple deployments and override the file when provided.

| Variable | Default | Description |
|----------|---------|-------------|
| `SSH_MCP_POLICY_FILE` | unset | JSON policy file. |
| `SSH_MCP_POLICY_MODE` | `enforce` | `enforce` or `explain`. |
| `SSH_MCP_ALLOW_RAW_SUDO` | `false` | Allows raw `proc_sudo`. |
| `SSH_MCP_ALLOW_DESTRUCTIVE_COMMANDS` | `false` | Allows high-risk command patterns. |
| `SSH_MCP_ALLOW_DESTRUCTIVE_FS` | `false` | Allows destructive fs operations outside guarded defaults. |
| `SSH_MCP_ALLOWED_HOSTS` | unset | Comma-separated exact strings or regexes. |
| `SSH_MCP_COMMAND_ALLOW` | unset | Comma-separated command regex allow-list. |
| `SSH_MCP_COMMAND_DENY` | unset | Comma-separated command regex deny-list. |
| `SSH_MCP_PATH_ALLOW_PREFIXES` | `/tmp,/var/tmp,/home,/Users` | Prefixes where destructive fs operations may be allowed. |
| `SSH_MCP_PATH_DENY_PREFIXES` | protected system paths | Prefixes that are always denied. |
| `SSH_MCP_LOCAL_PATH_ALLOW_PREFIXES` | OS temp directory | MCP-server-host local prefixes allowed for `file_upload` sources and `file_download` destinations. |
| `SSH_MCP_LOCAL_PATH_DENY_PREFIXES` | unset | MCP-server-host local prefixes that are always denied for transfers. |

Example:

```json
{
  "mode": "enforce",
  "allowRootLogin": false,
  "allowRawSudo": false,
  "allowDestructiveCommands": false,
  "allowDestructiveFs": false,
  "allowedHosts": ["^prod-[0-9]+\\.example\\.com$"],
  "commandAllow": ["^(uname|df|uptime|systemctl status)\\b"],
  "commandDeny": ["rm\\s+-rf\\s+/", "shutdown", "reboot"],
  "pathAllowPrefixes": ["/tmp", "/home/deploy"],
  "pathDenyPrefixes": ["/etc/shadow", "/etc/sudoers", "/boot", "/dev", "/proc"],
  "localPathAllowPrefixes": ["/var/tmp/mcp-ssh-tool"],
  "localPathDenyPrefixes": []
}
```

## HTTP Transport

| Variable | Default | Description |
|----------|---------|-------------|
| `SSH_MCP_HTTP_HOST` | `127.0.0.1` | Bind host for Streamable HTTP. |
| `SSH_MCP_HTTP_PORT` / `PORT` | `3000` | Bind port. |
| `SSH_MCP_HTTP_BEARER_TOKEN_FILE` | unset | File containing the bearer token. Required for non-loopback bind. |
| `SSH_MCP_HTTP_ALLOWED_ORIGINS` | loopback origins | Comma-separated Origin allow-list. Required for non-loopback bind. |
| `SSH_MCP_ENABLE_LEGACY_SSE` | `false` | Enables compatibility `/sse` and `/messages` endpoints for one v2 cycle. |

## Example `.env`

```dotenv
LOG_LEVEL=info
LOG_FORMAT=json
SSH_MCP_HOST_KEY_POLICY=strict
SSH_MCP_KNOWN_HOSTS_PATH=/etc/ssh/ssh_known_hosts
SSH_MCP_POLICY_FILE=/etc/mcp-ssh-tool/policy.json
SSH_MCP_MAX_SESSIONS=50
SSH_MCP_SESSION_TTL=1800000
SSH_MCP_COMMAND_TIMEOUT=45000
SSH_MCP_MAX_FILE_SIZE=10485760
SSH_MCP_LOCAL_PATH_ALLOW_PREFIXES=/var/tmp/mcp-ssh-tool
SSH_MCP_HTTP_HOST=127.0.0.1
SSH_MCP_HTTP_PORT=3000
```

## Per-Session Overrides

`ssh_open_session` supports `hostKeyPolicy`, `expectedHostKeySha256`, `knownHostsPath`, and `policyMode`. Use `policyMode: "explain"` to produce a connection plan without opening SSH.

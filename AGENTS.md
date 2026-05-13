# AGENTS.md - mcp-ssh-tool

Guidance for AI agents using `mcp-ssh-tool` v2.

## Quick Start

```json
{
  "name": "mcp-ssh-tool",
  "command": "mcp-ssh-tool",
  "type": "stdio"
}
```

## Secure Defaults

- Host-key verification is strict by default.
- Root SSH login is denied unless policy allows it.
- Raw `proc_sudo` is denied unless policy allows it.
- Destructive commands and filesystem operations are policy-controlled.
- Use `policyMode: "explain"` before mutations when you need a plan or user confirmation.

## Recommended Workflow

1. `ssh_list_configured_hosts` to discover aliases when useful.
2. `ssh_open_session` with `hostKeyPolicy: "strict"` or `expectedHostKeySha256`.
3. `os_detect` to learn platform capabilities.
4. Read `mcp-ssh-tool://policy/effective` before privileged or destructive work.
5. Use task tools: `fs_*`, `proc_exec`, `ensure_*`, `file_*`, `tunnel_*`.
6. `ssh_close_session` when work is complete.

## Tool Guidance

| Tool | Use |
|------|-----|
| `ssh_open_session` | Open a persistent SSH connection. Reuse one session per host per task. |
| `proc_exec` | Run non-interactive commands. Destructive patterns may be denied. |
| `proc_sudo` | Raw sudo only when policy explicitly permits it. Prefer `ensure_*`. |
| `proc_exec_stream` | Long-running commands or output that should stream. |
| `fs_read` | Text-focused reads with size limits. Use `file_download` for large files. |
| `fs_write` | Write text data. Policy may deny protected paths. |
| `fs_rmrf` | Destructive delete. Use explain mode and confirm before invoking. |
| `file_upload` / `file_download` | SFTP transfers with checksum verification. |
| `ensure_package` | Idempotent package install/remove. |
| `ensure_service` | Idempotent service state changes where supported. |
| `ensure_lines_in_file` | Idempotent line management. |
| `patch_apply` | Apply unified diffs with dry-run behavior. |
| `tunnel_*` | Real SSH local/remote forwarding. Close tunnels when finished. |

## Resources

- `mcp-ssh-tool://sessions/active`
- `mcp-ssh-tool://metrics/json`
- `mcp-ssh-tool://metrics/prometheus`
- `mcp-ssh-tool://ssh-config/hosts`
- `mcp-ssh-tool://policy/effective`
- `mcp-ssh-tool://audit/recent`
- `mcp-ssh-tool://capabilities/support-matrix`

## Prompts

- `safe-connect`
- `inspect-host-capabilities`
- `plan-mutation`
- `managed-config-change`

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Opening a new session for every tool call | Reuse the existing `sessionId`. |
| Disabling host-key checks for production | Populate `known_hosts` or pin `expectedHostKeySha256`. |
| Using raw `proc_sudo` for package/service work | Prefer `ensure_package` or `ensure_service`. |
| Reading huge files with `fs_read` | Use `file_download`. |
| Treating BusyBox/dropbear as full Linux | Check `sftpAvailable` and support matrix first. |

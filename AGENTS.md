# AGENTS.md — mcp-ssh-tool

Guidance for AI agents using `mcp-ssh-tool` tools.

---

## Quick Start

```json
{
  "name": "mcp-ssh-tool",
  "command": "mcp-ssh-tool",
  "type": "stdio"
}
```

---

## Tool Reference

### Session Management

| Tool | When to use |
|------|-------------|
| `ssh_open_session` | **Always call this first.** Opens a persistent SSH connection. Returns a `session_id` required by all other tools. |
| `ssh_close_session` | Call when work on a host is complete. Frees resources. |
| `ssh_list_sessions` | Check existing open sessions before opening a new one — reuse when possible. |
| `ssh_ping` | Verify a session is still alive before a long operation. |
| `ssh_list_configured_hosts` | Enumerate hosts from `~/.ssh/config`. Useful for discovery before connecting. |
| `ssh_resolve_host` | Resolve a hostname alias from SSH config before connecting. |

**Rule:** One `session_id` per host per task. Reuse across tool calls in the same conversation.

---

### Command Execution

| Tool | When to use |
|------|-------------|
| `proc_exec` | Run any shell command. Returns stdout, stderr, and exit code. Use for most tasks. |
| `proc_sudo` | Run command as root via `sudo`. Use only when elevated privileges are genuinely required. |
| `proc_exec_stream` | Long-running commands (builds, log tailing). Streams output as it arrives. |

**Safety:** The server provides risk-level warnings (`low` / `medium` / `high` / `critical`) for destructive commands. Always surface `critical` warnings to the user before executing.

---

### File System

| Tool | When to use |
|------|-------------|
| `fs_read` | Read file contents. Prefer over `proc_exec cat` — returns structured output. |
| `fs_write` | Write or overwrite a file. |
| `fs_stat` | Check if a file/directory exists, get size and permissions. |
| `fs_list` | List directory contents. Prefer over `proc_exec ls`. |
| `fs_mkdirp` | Create directory tree (like `mkdir -p`). |
| `fs_rmrf` | Delete files or directories recursively. **Irreversible — confirm with user first.** |
| `fs_rename` | Move or rename a file. |

---

### File Transfer

| Tool | When to use |
|------|-------------|
| `file_upload` | Upload a local file to the remote server via SFTP. |
| `file_download` | Download a remote file to local disk via SFTP. |

---

### Idempotent State Management

| Tool | When to use |
|------|-------------|
| `ensure_package` | Install or remove a system package (`state: present` or `absent`). Idempotent — safe to call multiple times. |
| `ensure_service` | Start, stop, enable, disable, or restart a systemd service. |
| `ensure_lines_in_file` | Add or remove specific lines in a config file. Idempotent. |
| `patch_apply` | Apply a unified diff to a remote file. |

**Prefer `ensure_*` over `proc_exec apt install`** — they are idempotent and return a structured result with `changed: true/false`.

---

### System & Monitoring

| Tool | When to use |
|------|-------------|
| `os_detect` | Detect OS family, distro, version, and package manager. Call once per session before using `ensure_package`. |
| `get_metrics` | Get CPU, memory, disk, and load average. |

---

### Tunnels

| Tool | When to use |
|------|-------------|
| `tunnel_local_forward` | Forward a remote port to localhost (e.g., reach a remote DB locally). |
| `tunnel_remote_forward` | Expose a local port on the remote server. |
| `tunnel_list` | List active tunnels. |
| `tunnel_close` | Close a specific tunnel when no longer needed. |

---

## Recommended Workflow

```
1. ssh_list_configured_hosts   → discover available hosts
2. ssh_open_session            → connect, get session_id
3. os_detect                   → know the OS before running commands
4. <task tools>                → fs_*, proc_exec, ensure_*, get_metrics …
5. ssh_close_session           → clean up
```

---

## Limits & Constraints

- **Rate limiting** is enforced server-side. Burst of rapid calls may be throttled.
- **Concurrent sessions:** Multiple hosts can be open simultaneously with different `session_id` values.
- **Streaming:** `proc_exec_stream` should be used for commands expected to run longer than ~30 seconds.
- **Strict host key checking** is off by default. For production environments, set `STRICT_HOST_KEY_CHECKING=true`.
- **HTTP transport:** Bind to loopback only (`MCP_HTTP_HOST=127.0.0.1`) and place behind an authenticated reverse proxy.

---

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Calling `proc_exec` without a `session_id` | Always call `ssh_open_session` first |
| Using `proc_exec apt install` for packages | Use `ensure_package` instead — it is idempotent |
| Running `fs_rmrf` without user confirmation | Always confirm destructive operations |
| Opening a new session for every tool call | Reuse `session_id` within a conversation |
| Ignoring `critical` safety warnings | Surface them to the user — do not auto-execute |

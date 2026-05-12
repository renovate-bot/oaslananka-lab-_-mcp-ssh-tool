# Agent Installation

The SshAutomator agent runs on the user's host and connects outbound to the control plane. It is the only component that can execute local commands.

## Enroll

Create an enrollment token through the MCP tool `create_enrollment_token` or the API:

```bash
curl -X POST https://sshautomator.example.com/api/agents/enrollment-tokens \
  -H "Authorization: Bearer <access-token>" \
  -H "Content-Type: application/json" \
  -d '{"alias":"prod-1","requested_profile":"read-only"}'
```

Run the returned command on the target host:

```bash
npx --yes --package mcp-ssh-tool@latest mcp-ssh-agent enroll \
  --server https://sshautomator.example.com \
  --token <one-time-token> \
  --alias prod-1
```

The token is one-time use and expires quickly. It is stored only as a hash on the server.

## Run

```bash
npx --yes --package mcp-ssh-tool@latest mcp-ssh-agent run
```

Keep this command running in its own terminal or supervised service. The command opens the outbound connection to the control plane; if the terminal is closed, the agent goes offline and ChatGPT cannot dispatch actions to the host.

The agent reads its local config from:

```text
~/.sshautomator/agent.json
```

Override with:

```bash
SSHAUTOMATOR_AGENT_CONFIG=/secure/path/agent.json npx --yes --package mcp-ssh-tool@latest mcp-ssh-agent run
```

## Status

```bash
npx --yes --package mcp-ssh-tool@latest mcp-ssh-agent status
```

The status command prints the server URL, agent ID, alias, profile, and config path. It does not print private keys or tokens.

## Service Installation

The CLI provides platform-aware service guidance:

```bash
npx --yes --package mcp-ssh-tool@latest mcp-ssh-agent install-service
npx --yes --package mcp-ssh-tool@latest mcp-ssh-agent uninstall-service
```

Linux production deployments should run the agent under a dedicated non-root user by default. Full-admin mode is an explicit choice and should be limited to trusted hosts.

## Privileged Operations

The default agent profile does not run privileged commands. `run_shell_as_root` requires `sudo.exec` and uses non-interactive `sudo -n`; it never accepts or pipes sudo passwords.

For restricted production elevation, prefer allowlisted wrapper scripts in sudoers instead of broad `NOPASSWD: ALL`.

## Revocation

Revoking an agent disconnects the active WebSocket and prevents new actions from being dispatched. Delete the local config file after revocation if the host should be decommissioned.

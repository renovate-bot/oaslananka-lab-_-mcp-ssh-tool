# Migration To Remote-Agent Mode

Existing local MCP usage is preserved. Running `mcp-ssh-tool` with no arguments still starts the stdio MCP server and exposes the direct SSH toolset for trusted local clients.

Remote connector usage is different by design. ChatGPT does not receive SSH credentials and the hosted service does not SSH directly into user machines.

## Before

Local clients used tools such as:

- `ssh_open_session`
- `proc_exec`
- `fs_read`
- `file_upload`
- `tunnel_local_forward`

Those tools remain available in local stdio mode.

## After

Remote connector clients use tools such as:

- `list_agents`
- `create_enrollment_token`
- `get_system_status`
- `tail_logs`
- `restart_service`
- `docker_ps`
- `file_read`
- `run_shell`

These tools route through an enrolled outbound agent and are capability-gated.

## Migration Steps

1. Deploy the control plane with `SSHAUTOMATOR_REMOTE_AGENT_CONTROL_PLANE=true`.
2. Configure `PUBLIC_BASE_URL`, `MCP_RESOURCE_URL`, GitHub OAuth, and user allowlists.
3. Register the MCP URL in ChatGPT as `https://<host>/mcp`.
4. Use `create_enrollment_token` to create a one-time agent install command.
5. Run the agent enrollment command on the target host.
6. Start the agent with `mcp-ssh-agent run` or a supervised service.
7. Begin with `read-only` or `operations`; use `full-admin` only after explicit review.

## Credential Handling Change

Remote mode replaces server-side SSH credential custody with local agent custody:

- SSH keys remain on the user's host.
- SSH passwords are not submitted to the platform.
- Root passwords are not submitted to the platform.
- The control plane stores the agent public key and policy only.

## Compatibility

The direct SSH provider is local-only. It is appropriate for stdio clients running on a trusted workstation. Public HTTP connector deployments should use the remote-agent provider.

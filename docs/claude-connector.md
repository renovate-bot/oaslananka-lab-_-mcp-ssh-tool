# Claude Web Remote MCP Connector Readiness

Claude Web custom connectors use a remotely reachable MCP server URL. Localhost or private LAN-only MCP servers are not sufficient for Claude Web because Claude connects from Anthropic-operated infrastructure.

This repository includes a readiness scaffold in `apps/claude/connector-readiness.json`. It is not a production connector submission and it does not publish anything. The validator is:

```bash
npm run validate:claude-connector
```

## Required Runtime Profile

Run public Claude connector deployments with:

```bash
SSH_MCP_TOOL_PROFILE=claude
SSH_MCP_ALLOWED_HOSTS=prod-alias
SSH_MCP_HTTP_AUTH_MODE=oauth
SSH_MCP_OAUTH_ISSUER=https://auth.example
SSH_MCP_OAUTH_AUDIENCE=https://ssh-mcp.example/mcp
SSH_MCP_OAUTH_JWKS_URL=https://auth.example/.well-known/jwks.json
SSH_MCP_OAUTH_REQUIRED_SCOPES=mcp-ssh-tool.read
mcp-ssh-tool --transport=http --host 0.0.0.0 --port 3000
```

Bearer auth remains available for local development and existing deployments, but production Claude Web connector setup should use OAuth/JWKS or an equivalent platform-accepted authentication model.

## Safe Tool Surface

The `claude` profile exposes only:

- `connector_status`
- `ssh_hosts_list`
- `ssh_policy_explain`
- `ssh_host_inspect`
- `ssh_mutation_plan`

The profile hides raw session creation, raw command execution, sudo, writes, deletes, transfers, and tunnels. Users must not enter SSH usernames, passwords, passphrases, private keys, bearer tokens, or secret-manager credentials in Claude chat.

## Credential Broker

Use one of the server-side credential providers:

- `SSH_MCP_CONNECTOR_CREDENTIAL_PROVIDER=agent`: local SSH agent and SSH config on the trusted MCP server host.
- `SSH_MCP_CONNECTOR_CREDENTIAL_PROVIDER=command`: a configured executable receives a small JSON request on stdin and returns validated JSON. Use this to integrate Vault, SSH CA, or another secret manager outside chat.

The resolver command is executed without a shell, has a timeout, and its schema rejects password, passphrase, inline private key, and token fields. Resolver stderr is not surfaced to clients.

## Publishing Boundary

Keep `publishReady=false` until all of these exist:

- public HTTPS MCP endpoint
- production auth provider
- allowed origins / reverse proxy policy
- host allowlist
- strict host-key verification
- privacy and support links
- review test cases
- operator approval for connector rollout

Repository CI may validate this scaffold, but it must not publish a Claude connector.

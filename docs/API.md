# Remote Control Plane API

API resource endpoints and token/enrollment responses return JSON. Interactive OAuth endpoints such as `GET /oauth/authorize` can return redirects or HTML through the identity-provider login flow. Secret values are returned only when immediately required by the caller, such as the one-time enrollment token response.

## OAuth / DCR

### `POST /oauth/register`

Registers an OAuth public PKCE client.

Request:

```json
{
  "client_name": "ChatGPT Connector",
  "redirect_uris": ["https://chatgpt.com/..."]
}
```

Response:

```json
{
  "client_id": "cli_...",
  "client_name": "ChatGPT Connector",
  "redirect_uris": ["https://chatgpt.com/..."],
  "grant_types": ["authorization_code"],
  "response_types": ["code"],
  "token_endpoint_auth_method": "none"
}
```

### `GET /oauth/authorize`

Supports Authorization Code + PKCE S256 and GitHub login.

Required query parameters:

- `client_id`
- `redirect_uri`
- `response_type=code`
- `code_challenge`
- `code_challenge_method=S256`
- `resource`
- `scope`
- `state`

### `POST /oauth/token`

Exchanges an authorization code for a short-lived bearer token.

## Agent API

### `POST /api/agents/enrollment-tokens`

Requires `agents:admin`.

Request:

```json
{
  "alias": "prod-1",
  "labels": ["prod"],
  "requested_profile": "read-only"
}
```

Response includes `enrollment_token` and install commands. The token is stored only as a hash server-side and cannot be recovered later.

### `POST /api/agents/enroll`

Called by the local agent.

Request:

```json
{
  "token": "<one-time-token>",
  "public_key": "-----BEGIN PUBLIC KEY-----...",
  "host": {
    "hostname": "prod-1",
    "os": "Linux",
    "arch": "x64",
    "platform": "linux"
  }
}
```

### `GET /api/agents`

Lists the authenticated user's agents.

### `PATCH /api/agents/:id/policy`

Updates agent policy. Requires `agents:admin`.

`PATCH /api/agents/:id` is retained as a compatibility alias for the same operation.

### `POST /api/agents/:id/revoke`

Revokes an agent. Requires `agents:admin`.

### `GET /api/audit`

Lists recent audit events.

## MCP Tools

Remote MCP tools are exposed through JSON-RPC `POST /mcp`:

- `list_hosts`
- `list_agents`
- `create_enrollment_token`
- `get_agent_install_command`
- `get_system_status`
- `tail_logs`
- `restart_service`
- `docker_ps`
- `docker_logs`
- `docker_restart`
- `file_read`
- `file_write`
- `run_shell`
- `run_shell_as_root`
- `update_agent_policy`
- `revoke_agent`
- `get_audit_events`

Tool visibility is filtered by OAuth scopes and internal capabilities.

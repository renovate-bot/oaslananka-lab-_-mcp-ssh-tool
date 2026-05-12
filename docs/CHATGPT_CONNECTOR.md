# ChatGPT Remote Connector Setup

Remote connector mode exposes an HTTPS MCP endpoint with OAuth and Dynamic Client Registration.

## URLs

For production, configure:

```text
Website URL: https://sshautomator.example.com
MCP Server URL: https://sshautomator.example.com/mcp
```

The public base URL must match:

```bash
PUBLIC_BASE_URL=https://sshautomator.example.com
MCP_RESOURCE_URL=https://sshautomator.example.com/mcp
```

## Required Endpoints

The control plane provides:

- `GET /.well-known/oauth-protected-resource`
- `GET /.well-known/oauth-authorization-server`
- `POST /oauth/register`
- `GET /oauth/authorize`
- `POST /oauth/token`
- `GET /oauth/jwks.json`
- `POST /mcp`
- `GET /healthz`
- `GET /readyz`

`GET /mcp` without authorization returns `401`, which is expected. The MCP endpoint expects authenticated JSON-RPC POST requests.

## Auth0 vs Built-In OAuth

The remote-agent architecture includes a built-in OAuth/DCR server for ChatGPT connector registration. External Auth0 configuration is not required for this mode.

If an external provider is used instead, it must issue access tokens with:

- issuer matching the configured OAuth issuer
- audience equal to `MCP_RESOURCE_URL`
- scopes mapped to SshAutomator capabilities
- RS256/EdDSA or another explicitly configured allowed algorithm

## GitHub Identity Provider

Create a GitHub OAuth application and configure:

```bash
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
GITHUB_CALLBACK_URL=https://sshautomator.example.com/oauth/callback/github
AUTH_ALLOW_ALL_USERS=false
AUTH_ALLOWED_GITHUB_LOGINS=
AUTH_ALLOWED_GITHUB_IDS=
```

Default is deny-all. Add allowed GitHub users or deliberately set `AUTH_ALLOW_ALL_USERS=true`.

## Local Development

```bash
pnpm install --frozen-lockfile
pnpm run build
SSHAUTOMATOR_REMOTE_AGENT_CONTROL_PLANE=true \
  PUBLIC_BASE_URL=http://localhost:3000 \
  MCP_RESOURCE_URL=http://localhost:3000/mcp \
  AUTH_ALLOW_ALL_USERS=true \
  node dist/index.js http --host 127.0.0.1 --port 3000
```

For a public ChatGPT connector, place this behind HTTPS and use the HTTPS public URL in the connector form.

## Common Errors

| Symptom | Meaning | Fix |
|---|---|---|
| `GET /mcp` returns `401` | Endpoint is protected | Use the OAuth connector flow or send a valid bearer token |
| `invalid redirect_uri` | DCR or authorize redirect mismatch | Use the redirect URI registered by ChatGPT |
| `GitHub user is not allowed` | Allowlist denied login | Add login/ID or set `AUTH_ALLOW_ALL_USERS=true` intentionally |
| `AGENT_OFFLINE` | No outbound agent is connected | Run `npx --yes --package mcp-ssh-tool@latest mcp-ssh-agent run` on the host |
| `CAPABILITY_DENIED` | Agent local policy denied action | Update the agent profile/policy deliberately |

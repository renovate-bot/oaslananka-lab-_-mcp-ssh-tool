# ChatGPT App Readiness

This repository contains a ChatGPT app readiness scaffold under `apps/chatgpt/`. It is not a production app manifest and it does not publish an app.

As of the current OpenAI Apps SDK documentation, app submission is a dashboard review flow that requires a public HTTPS MCP server URL, organization/app verification, tool descriptor review, component CSP metadata when widgets are used, screenshots, review test cases, support/privacy URLs, and working auth if the app requires credentials.

## Current Status

| Area | Status |
|------|--------|
| MCP package | Ready as local stdio package `mcp-ssh-tool` |
| Streamable HTTP | Available, loopback by default |
| Remote connector profile | `SSH_MCP_TOOL_PROFILE=chatgpt` |
| Safe remote tools | `connector_status`, `ssh_hosts_list`, `ssh_policy_explain`, `ssh_host_inspect`, `ssh_mutation_plan` |
| OAuth/JWKS runtime path | Available for production resource-server token validation |
| Public HTTPS backend | Not configured |
| App dashboard setup | Not configured |
| Domain verification | Not configured |
| Widget/component bundle | Not configured |
| App publish workflow | Not present |
| Validator | `npm run validate:chatgpt-app` |

`apps/chatgpt/app-readiness.json` intentionally sets `publishReady` to `false`.

The validator is fail-fast by design. If OpenAI app publishing setup is incomplete, the repository must keep `publishReady=false`; it must not invent a production manifest or publish workflow.

## Security Model

Default ChatGPT app behavior must be read-only inspection through the `chatgpt` connector profile:

- no SSH private keys in chat
- no passphrases, passwords, bearer tokens, or cookies in chat
- host allowlist required
- strict host-key verification default
- user-managed SSH config/policy or a server-side credential broker preferred
- no raw command execution by default
- no `proc_sudo` by default
- no file writes, transfers, tunnels, package changes, service changes, or destructive filesystem operations without policy allow and explicit user confirmation
- non-loopback HTTP requires a restricted profile, auth, allowed origins, host allowlist, and strict host-key policy
- tool output must not expose credentials or policy secrets

The `chatgpt` profile hides `ssh_open_session`, `proc_exec`, `proc_sudo`, write/delete tools, transfers, and tunnels. ChatGPT users select a host alias; the server resolves credentials from a local SSH agent or a configured command provider.

## Local Development Shape

Local MCP stdio:

```json
{
  "servers": {
    "ssh-mcp": {
      "type": "stdio",
      "command": "mcp-ssh-tool",
      "args": []
    }
  }
}
```

Local Streamable HTTP for development:

```bash
printf '%s' 'dev-only-token' > .mcp-token
mcp-ssh-tool --transport=http --host 127.0.0.1 --port 3000 --bearer-token-file .mcp-token --tool-profile chatgpt
```

Do not expose a public ChatGPT connector to localhost. For ChatGPT developer testing, use a public HTTPS endpoint or tunnel only after configuring `SSH_MCP_TOOL_PROFILE=chatgpt`, auth, allowed origins, request-size limits, redaction, host allowlists, and strict host-key verification.

## Credential Broker

ChatGPT must not collect SSH usernames, passwords, passphrases, or private keys through normal chat. Use one of these server-side modes:

- `SSH_MCP_CONNECTOR_CREDENTIAL_PROVIDER=agent`: use the local SSH agent and SSH config on the trusted MCP server host.
- `SSH_MCP_CONNECTOR_CREDENTIAL_PROVIDER=command`: execute a configured resolver command without a shell. The resolver receives JSON on stdin and returns validated JSON with `host`, `username`, `auth`, `privateKeyPath` or agent usage, host-key metadata, and short TTLs. It must not print secrets to stderr.

Command-provider examples should wrap Vault, SSH CA, or a secret manager outside this repository. Do not put credentials in `apps/chatgpt/app-readiness.json`, docs, examples, logs, or tool output.

## Production OAuth

Bearer auth remains supported for local development and existing deployments. Public ChatGPT app deployment should use OAuth/JWKS resource-server validation:

- `SSH_MCP_HTTP_AUTH_MODE=oauth`
- `SSH_MCP_OAUTH_ISSUER`
- `SSH_MCP_OAUTH_AUDIENCE`
- `SSH_MCP_OAUTH_JWKS_URL`
- `SSH_MCP_OAUTH_REQUIRED_SCOPES`

The server exposes protected resource metadata at `/.well-known/oauth-protected-resource`. Keep `publishReady=false` until the production HTTPS endpoint, OAuth provider, domain verification, privacy/support links, screenshots, and review test cases are ready.

## Production Checklist

Before setting `publishReady=true`:

- create a public HTTPS MCP endpoint
- configure OAuth/JWKS for production or a reviewed equivalent accepted by OpenAI
- configure allowed origins and component CSP
- run the server with `SSH_MCP_TOOL_PROFILE=chatgpt`
- configure `SSH_MCP_ALLOWED_HOSTS`
- provide support, privacy, and terms URLs
- provide app icon, screenshots, review test prompts, and expected responses
- verify tool annotations match actual behavior
- verify no credentials appear in `structuredContent`, `content`, `_meta`, widget state, logs, or audit exports
- run `npm run validate:chatgpt-app`

If OpenAI publishing requirements change, update this document and the validator before adding publish automation.

## Control Plane Boundary

ChatGPT app readiness is advisory until dashboard setup, verified domain, public HTTPS hosting, CSP, auth, screenshots, and review test cases are complete. Repository automation may validate the scaffold, but it must not publish an app or enable credential entry through ordinary chat.

# Remote MCP Connector Threat Model

This threat model covers public or non-loopback Streamable HTTP MCP deployments for ChatGPT Apps and Claude Web custom connectors.

## Assets

- SSH host aliases, hostnames, usernames, known-host fingerprints, and SSH config details
- SSH private keys, passphrases, passwords, SSH agent sockets, bearer tokens, OAuth tokens, and resolver outputs
- Remote command output, file contents, audit records, and policy configuration
- npm, MCP Registry, GHCR, GitHub Release, and mirror automation authority

## Trust Boundary

Remote AI clients are not trusted to receive or store SSH credentials. They may request inspection of an allowed host alias, but credential resolution happens only inside the trusted MCP server environment through a local SSH agent or an explicitly configured command provider.

## Required Controls

- `full` profile is local/trusted only.
- Public or non-loopback HTTP requires `remote-safe`, `chatgpt`, `claude`, `remote-readonly`, or `remote-broker`.
- Public or non-loopback HTTP requires auth, allowed origins, `SSH_MCP_ALLOWED_HOSTS`, and strict host-key verification.
- ChatGPT/Claude profiles expose only safe connector tools.
- OAuth/JWKS validation checks issuer, audience, scope, expiry, not-before, `kid`, algorithm, and signature.
- Credential command provider uses no shell, has a timeout, validates output schema, and hides stderr from tool output.
- Resolver output must not include password, passphrase, inline private key, bearer token, or secret values.
- Mutation execution is not exposed in remote connector profiles.

## Denied-by-Default Classes

| Class | Examples | Remote connector behavior |
|-------|----------|---------------------------|
| Raw credentials | passwords, passphrases, private keys, bearer tokens | rejected from tool schemas and readiness files |
| Raw execution | `proc_exec`, `proc_sudo`, arbitrary shell | hidden in remote profiles |
| File mutation | write, delete, upload, download | hidden in remote profiles |
| Network mutation | local/remote tunnels | hidden in remote profiles |
| Release authority | npm, MCP Registry, GHCR, GitHub Release, force mirror | never available through app connector tools |

## Residual Risk

Read-only inspection can still reveal sensitive operational data from command output. Keep checks bounded, truncate output, redact known secret patterns, and restrict host allowlists to systems intentionally exposed to remote AI-assisted inspection.

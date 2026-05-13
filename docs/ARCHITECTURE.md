# SshAutomator No-Custody Architecture

`mcp-ssh-tool` now supports two execution models:

| Mode | Transport | Execution boundary |
|---|---|---|
| Local MCP | stdio / local HTTP | Direct local SSH provider, intended for trusted desktop or operator environments |
| Remote connector | HTTPS MCP + OAuth + DCR | Control plane broker with outbound local agents; the platform never receives SSH credentials |

## Remote Connector Flow

```text
ChatGPT MCP Connector
  -> OAuth 2.1 + Dynamic Client Registration
  -> SshAutomator HTTPS MCP endpoint
  -> capability and policy check
  -> signed action envelope
  -> outbound WebSocket agent
  -> local command execution on the user's host
  -> signed result envelope
  -> MCP response
```

The control plane stores user identity, OAuth client metadata, hashed authorization codes, hashed enrollment tokens, agent public keys, policies, action records, and audit events. It does not store SSH private keys, SSH passwords, root passwords, cloud credentials, bearer token plaintext, or one-time enrollment token plaintext after issuance.

## Components

### MCP Server / Control Plane

Control-plane mode is enabled with:

```bash
SSHAUTOMATOR_REMOTE_AGENT_CONTROL_PLANE=true mcp-ssh-tool http --host 0.0.0.0 --port 3000
```

It exposes:

- `GET /.well-known/oauth-protected-resource`
- `GET /.well-known/oauth-authorization-server`
- `POST /oauth/register`
- `GET /oauth/authorize`
- `GET /oauth/callback/github`
- `POST /oauth/token`
- `GET /oauth/jwks.json`
- `POST /mcp`
- `GET /healthz`
- `GET /readyz`
- `POST /api/agents/enrollment-tokens`
- `POST /api/agents/enroll`
- `GET /api/agents`
- `GET /api/agents/:id`
- `PATCH /api/agents/:id/policy`
- `POST /api/agents/:id/revoke`
- `GET /api/audit`
- `GET /api/agents/connect` as WebSocket upgrade

### Agent

The agent runs on the user's own machine or server:

```bash
npx --yes --package mcp-ssh-tool@latest mcp-ssh-agent enroll --server https://sshautomator.example.com --token <one-time-token> --alias prod-1
npx --yes --package mcp-ssh-tool@latest mcp-ssh-agent run
```

The agent generates an Ed25519 keypair locally, sends only the public key during enrollment, connects outbound over WebSocket, verifies control-plane signatures, enforces local policy, executes bounded actions, signs results, and returns them to the control plane.

### Shared Protocol

Shared protocol code lives in `src/remote/`:

- `types.ts`: capabilities, tools, envelope types, stable error codes
- `crypto.ts`: Ed25519 signing, JWT signing, token hashing
- `policy.ts`: profile and capability policy evaluation
- `store.ts`: SQLite-backed users, clients, agents, actions, audit records
- `control-plane.ts`: OAuth/DCR/API/MCP/WSS orchestration
- `agent-executor.ts`: local bounded execution and agent-side policy enforcement

## Trust Boundaries

- ChatGPT receives OAuth-scoped MCP access only.
- The control plane can request actions only through signed envelopes.
- The agent rejects unsigned, replayed, expired, wrong-agent, or locally denied actions.
- Remote mode does not accept raw SSH passwords or private keys from chat.
- `run_shell` and `run_shell_as_root` exist only behind explicit capabilities and are denied by the default read-only profile.

## Policy Profiles

- `read-only`: host, agent, status, logs, and audit reads.
- `operations`: read-only plus service, Docker, and file read operations.
- `full-admin`: explicit administrative profile with shell, sudo, write, and agent admin capabilities.
- `custom`: explicit per-capability policy.

Policy is enforced twice: first by the control plane using OAuth scopes and agent policy, then by the local agent before execution.

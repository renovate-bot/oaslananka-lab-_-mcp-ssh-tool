# Remote-Agent Security Model

## No-Custody Boundary

Remote connector mode is designed so the hosted control plane cannot independently log in to a user's server. Users do not submit SSH private keys, SSH passwords, root passwords, cloud credentials, or long-lived login secrets to the platform.

The platform may store:

- GitHub identity and user ID
- OAuth client metadata
- hashed authorization codes
- hashed one-time enrollment tokens
- agent public keys
- agent metadata and policy
- action records and audit events

The platform must not store:

- SSH private keys
- SSH passwords
- root passwords
- cloud provider credentials
- plaintext enrollment tokens after they are returned to the user
- bearer access token plaintext

## Authentication

Remote connector mode uses:

- Dynamic Client Registration at `POST /oauth/register`
- Authorization Code + PKCE S256
- GitHub OAuth as the identity provider
- deny-all default user admission unless `AUTH_ALLOW_ALL_USERS=true` or an allowlist is configured
- short-lived JWT access tokens signed by the control plane
- JWKS at `GET /oauth/jwks.json`

Access tokens include issuer, audience, subject, scopes, issue time, expiry, and token ID. MCP requests must send `Authorization: Bearer <token>` and the token audience must match `MCP_RESOURCE_URL`.

## Agent Enrollment

Enrollment tokens are random 256-bit values, TTL-limited, one-time use, stored only as hashes, and never written to audit logs. The token is returned only in the enrollment response/install command.

During enrollment the agent generates an Ed25519 keypair locally and sends the public key to the control plane. The private key remains on the host.

## Signed Actions

Every action sent to an agent contains:

- action ID
- agent ID
- user ID
- tool name
- required capability
- policy version
- issue time and deadline
- nonce
- control-plane signature

The agent verifies the signature, agent ID, deadline, replay state, policy version, and local capability policy before execution.

Every action result is also signed by the agent and includes a per-result nonce. The control plane verifies the agent signature and rejects result nonces that were already seen on the live connection.

## Local Execution Controls

The agent:

- runs as the current OS user by default
- enforces max output bytes and timeouts
- kills child processes on timeout where the platform supports process groups
- denies privileged execution unless `sudo.exec` is enabled
- uses `sudo -n` only, never sudo password piping
- bounds file reads/writes by local path policy
- signs action results before sending them back

## Audit Events

The control plane records audit events for client registration, login, enrollment token creation, agent enrollment, agent connection/disconnection, policy updates, action requests, action completions/failures, and revocation. Audit metadata must not contain secrets.

## Production Requirements

- Use HTTPS for public deployments.
- Set `PUBLIC_BASE_URL` and `MCP_RESOURCE_URL` to stable HTTPS URLs.
- Configure `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, and `GITHUB_CALLBACK_URL`.
- Keep `AUTH_ALLOW_ALL_USERS=false` unless this is an intentionally public deployment.
- Prefer `read-only` or `operations` profiles for ChatGPT connector usage.
- Use `full-admin` only for explicitly trusted hosts and users.

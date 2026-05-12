# Security Decisions

This file records the v2 security posture and the rationale behind breaking changes.

## Secure By Default

v1 optimized first-run convenience. v2 optimizes defensible defaults:

- `hostKeyPolicy=strict`
- root SSH login denied
- raw `proc_sudo` denied
- destructive command patterns denied
- destructive filesystem operations constrained by path policy
- HTTP bound to loopback
- legacy SSE disabled

Users can still relax these controls, but the relaxation must be visible in policy or environment configuration.

## Host Key Policy

Boolean host-key settings were ambiguous, so v2 uses:

- `strict`
- `accept-new`
- `insecure`

`strictHostKeyChecking` and `STRICT_HOST_KEY_CHECKING` remain compatibility aliases. Fingerprint pinning is supported per session with `expectedHostKeySha256`.

## Root And Sudo

Root login and raw sudo have different risk profiles:

- Root SSH login is denied by default because every tool becomes privileged.
- Raw `proc_sudo` is denied by default because it bypasses higher-level idempotent tools.
- `ensure_*` tools can use managed sudo internally with policy metadata.

## Destructive Operations

Warnings are not enough for AI-driven automation. v2 denies dangerous commands and filesystem operations by default, then records policy denials in metrics and audit resources.

## HTTP Transport

Streamable HTTP is the modern remote transport. Because remote MCP exposure is sensitive, non-loopback HTTP startup requires:

- bearer token file
- allowed origin list

SSE remains available only behind `--enable-legacy-sse` for migration.

## Logging And Audit

Secrets are redacted before logging. Audit events are bounded in memory and exposed as an MCP resource for quick operator review. Long-term audit storage should be handled by the deployment environment.

## Residual Risk

This server does not sandbox SSH credentials. A client with tool access can perform any operation allowed by local policy and the remote account. Production deployments should combine this project with host-level least privilege, narrow sudoers rules, short session TTLs, and monitored logs.

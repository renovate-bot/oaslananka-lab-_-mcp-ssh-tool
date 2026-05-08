# Enterprise Deployment Guide

## Recommended Pattern

- Run stdio for local developer workstations.
- Run Streamable HTTP only inside a trusted network boundary or behind an authenticated reverse proxy.
- Keep `SSH_MCP_HTTP_HOST=127.0.0.1` unless the process is isolated and protected.
- Use `SSH_MCP_POLICY_FILE` managed by configuration management.
- Export JSON logs, Prometheus metrics, and OpenTelemetry traces.

## Baseline Policy

```json
{
  "mode": "enforce",
  "allowRootLogin": false,
  "allowRawSudo": false,
  "allowDestructiveCommands": false,
  "allowDestructiveFs": false,
  "allowedHosts": ["^prod-[0-9]+\\.example\\.com$"],
  "commandAllow": ["^(uname|uptime|df|free|systemctl status)\\b"],
  "commandDeny": ["rm\\s+-rf\\s+/", "mkfs", "dd\\s+if=", "shutdown", "reboot"],
  "pathAllowPrefixes": ["/tmp", "/var/tmp", "/home/deploy"],
  "pathDenyPrefixes": ["/etc/shadow", "/etc/sudoers", "/boot", "/dev", "/proc"]
}
```

## Host Credentials

- Prefer short-lived SSH certificates or narrowly scoped SSH keys.
- Avoid root SSH login.
- Use host-level sudoers rules for specific commands if escalation is required.
- Keep `known_hosts` centrally managed.
- Pin fingerprints with `expectedHostKeySha256` for sensitive sessions.

## HTTP Hardening

Minimum for non-loopback HTTP:

```bash
mcp-ssh-tool \
  --transport=http \
  --host 127.0.0.1 \
  --port 3000 \
  --bearer-token-file /run/secrets/mcp-ssh-token
```

If bound beyond loopback, also set `SSH_MCP_HTTP_ALLOWED_ORIGINS` and terminate TLS/auth at a reverse proxy.

## Release Controls

The personal GitHub repository is the source repository. The `oaslananka-lab` GitHub organization repository owns automatic CI/CD, security scanning, npm trusted-publishing/provenance, MCP Registry publishing, SBOMs, attestations, and GitHub Releases. Azure Pipelines are manual-only validation and release-control backups. Before publishing:

- `pnpm run lint`
- `pnpm test`
- `pnpm run build`
- `pnpm run pack:check`
- `pnpm audit --audit-level moderate`
- verify package contents and artifact hashes
- let release-please update release notes and version files

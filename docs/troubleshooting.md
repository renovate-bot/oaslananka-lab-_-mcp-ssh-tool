# Troubleshooting

## CI/CD And Release

### `corepack enable` fails with `EPERM` on Windows

`corepack enable` writes shims under the Node.js installation directory. If it fails without elevation, continue with:

```powershell
pnpm install --frozen-lockfile
```

### Trusted publish fails with a provenance repository mismatch

Check that `package.json.repository.url` is exactly:

```text
git+https://github.com/oaslananka-lab/mcp-ssh-tool.git
```

npm provenance validates the package metadata repository against the GitHub Actions repository that publishes the artifact.

### MCP Registry still shows an old version

Registry publishing is intentionally separate from npm trusted publishing until the official publisher path is re-enabled for the existing namespace. Verify the package release first, then check the latest endpoint:

```bash
curl https://registry.modelcontextprotocol.io/v0.1/servers/io.github.oaslananka%2Fmcp-ssh-tool/versions/latest
```

### Doppler verification fails in CI

GitHub should contain only `DOPPLER_TOKEN`. Required runtime secrets are listed in `.doppler/secrets.txt` and must exist in Doppler under the configured project/config.

## The MCP Server Does Not Appear

1. Confirm Node.js is `22.22.2+` or `24.14.1+`.
2. Confirm the command works: `mcp-ssh-tool --version`.
3. Use stdio config for local clients:

```json
{
  "servers": {
    "ssh-mcp": {
      "type": "stdio",
      "command": "mcp-ssh-tool"
    }
  }
}
```

Restart the MCP client after changing config.

## Host Key Verification Fails

v2 uses strict host-key verification by default. Fix the trust root instead of disabling checks:

```bash
ssh-keyscan -H example.com >> ~/.ssh/known_hosts
```

Then retry with `hostKeyPolicy: "strict"`. For one-off development targets, use `hostKeyPolicy: "accept-new"`. Use `hostKeyPolicy: "insecure"` only for disposable test environments.

## Root Login Or Sudo Is Denied

This is expected in v2. Root login and raw `proc_sudo` are policy-controlled.

Safer options:

- connect as an unprivileged user
- use `ensure_package`, `ensure_service`, `ensure_lines_in_file`, or `patch_apply`
- run `ssh_open_session` with `policyMode: "explain"` to see the policy verdict
- enable `allowRawSudo` only in a reviewed policy file

## A Destructive Command Is Denied

Commands such as recursive deletes, shutdowns, reboots, disk formatting, or privilege-sensitive edits can be denied before execution. Review `mcp-ssh-tool://policy/effective` and `mcp-ssh-tool://audit/recent`.

If the operation is intentional, prefer a narrower policy change such as a command allow-list or a path prefix instead of setting `allowDestructiveCommands=true` globally.

## `fs_read` Says The File Is Too Large

`fs_read` is text-focused and limited by `SSH_MCP_MAX_FILE_SIZE`. Use `file_download` for large files; it verifies SHA-256 integrity after transfer.

## SFTP Is Unavailable

BusyBox/dropbear and embedded targets often lack SFTP. The session can still open with `sftpAvailable: false`. Basic file tools fall back to portable shell probes where possible.

If fallbacks fail, confirm the target has basic utilities:

```bash
command -v cat mv rm mkdir ls stat wc
```

## Streamable HTTP Refuses To Start

Non-loopback HTTP is refused unless both are configured:

- bearer token file
- allowed origins

Example:

```bash
printf '%s' 'replace-me' > .mcp-token
mcp-ssh-tool --transport=http --host 127.0.0.1 --port 3000 --bearer-token-file .mcp-token
```

For remote exposure, keep the server behind a reverse proxy with TLS and authentication.

## Legacy SSE Client Fails

SSE compatibility is disabled by default. Enable it only during migration:

```bash
mcp-ssh-tool --transport=http --enable-legacy-sse
```

Prefer Streamable HTTP at `/mcp`.

## Tests

Unit tests:

```bash
pnpm test
```

Live SSH suites are opt-in:

```bash
RUN_SSH_INTEGRATION=1 pnpm run test:integration
RUN_SSH_E2E=1 pnpm run test:e2e
```

Docker fixture:

```bash
pnpm run e2e:docker
```

## Security Audit Fails

Run:

```bash
pnpm audit --audit-level moderate
```

Upgrade direct dependencies first. For transitive advisories, prefer dependency updates or overrides with a short security rationale in the release notes.

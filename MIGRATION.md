# v2 Migration Notes

`mcp-ssh-tool` v2 is a breaking release focused on secure defaults, modern remote transport, and policy enforcement.

## What Changed

- Node.js runtime floor is now `>=22.14.0`.
- Default host-key policy is `strict`.
- Root SSH login is denied by default.
- Raw `proc_sudo` is denied by default.
- Destructive commands and filesystem operations are policy-controlled.
- `ssh_open_session` supports `hostKeyPolicy`, `expectedHostKeySha256`, and `policyMode`.
- Streamable HTTP at `/mcp` replaces SSE as the recommended remote transport.
- Legacy SSE is opt-in with `--enable-legacy-sse`.
- Tool results include `structuredContent`, output schemas, and richer annotations.

## Before Upgrading

1. Upgrade Node.js to 22.14 or newer.
2. Populate `known_hosts` for every production host.
3. Write a policy file for any host, command, path, or sudo relaxations.
4. Update remote clients to Streamable HTTP.
5. Run a dry run with `policyMode: "explain"` for mutation workflows.

## Host Key Migration

Old:

```dotenv
STRICT_HOST_KEY_CHECKING=false
```

New production posture:

```dotenv
SSH_MCP_HOST_KEY_POLICY=strict
SSH_MCP_KNOWN_HOSTS_PATH=/etc/ssh/ssh_known_hosts
```

Temporary lab posture:

```json
{
  "hostKeyPolicy": "accept-new"
}
```

## Sudo Migration

Old workflows that called `proc_sudo` directly now need explicit policy:

```json
{
  "allowRawSudo": true
}
```

Prefer replacing raw sudo with `ensure_package`, `ensure_service`, `ensure_lines_in_file`, or `patch_apply`.

## HTTP Migration

Old SSE-style clients should move to `/mcp`. During migration:

```bash
mcp-ssh-tool --transport=http --enable-legacy-sse
```

Remove legacy SSE before the next major version.

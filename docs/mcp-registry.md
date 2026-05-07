# MCP Registry

The official MCP Registry server is already published as:

```text
io.github.oaslananka/mcp-ssh-tool
```

Keep this server name. Changing it would break existing users unless the official registry supports migration or aliasing without client disruption.

## Metadata Source

`server.json` is the official registry metadata source. It uses the active schema:

```text
https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json
```

`mcp.json` and `registry/mcp-ssh-tool/mcp.json` are legacy/internal compatibility metadata. They must keep version parity with `server.json`, `package.json`, `package-lock.json`, and `src/mcp.ts`.

Run:

```bash
node scripts/validate-mcp-metadata.mjs
```

The validator checks:

- npm package name `mcp-ssh-tool`
- MCP server name `io.github.oaslananka/mcp-ssh-tool`
- schema URL
- org repository URL
- package and server versions
- npm package entries
- stdio and loopback Streamable HTTP transport metadata
- legacy metadata drift
- runtime `SERVER_NAME` and `SERVER_VERSION`

## Publishing

`trusted-publish.yml` installs pinned `mcp-publisher` `v1.6.0` and verifies the release asset SHA256 before use. Dry-run mode prints the intended payload and does not authenticate or publish.

The live job publishes only when:

- the workflow runs in `oaslananka-lab/mcp-ssh-tool`
- `publish=true`
- `approval=APPROVE_RELEASE`
- environment approval succeeds
- the registry does not already report the package version

After publish, the workflow reads the Registry latest endpoint and fails unless the latest server version matches the package version.

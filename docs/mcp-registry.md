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

`mcp.json` and `registry/mcp-ssh-tool/mcp.json` are legacy/internal compatibility metadata. They must keep version parity with `server.json`, `package.json`, `pnpm-lock.yaml`, and `src/mcp.ts`.

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

Registry metadata stays version-synchronized by `release-please-config.json` and `scripts/validate-mcp-metadata.mjs`. Live MCP Registry publishing remains a separate controlled step until official publisher automation is re-enabled for the existing namespace without manual version input.

After any registry publish, read the Registry latest endpoint and verify that the latest server version matches the release version.

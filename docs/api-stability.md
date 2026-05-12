# API Stability

`mcp-ssh-tool` treats the MCP runtime surface as a public contract.

## Stable Surfaces

- Tool names
- Tool input schemas
- Tool output `structuredContent` shapes
- Resource URIs
- Prompt names
- `package.json#name`
- `package.json#mcpName`
- `server.json#name`

Backward-compatible additions are allowed in minor releases. Removing fields, renaming tools, changing resource URIs, or changing existing semantics requires a major release or a documented migration window.

## Operational Surfaces

The following may change in minor releases when needed for security or release reliability:

- GitHub Actions workflow internals
- Taskfile commands
- Local validation scripts
- Documentation structure
- Registry publishing automation

Operational changes must not alter the runtime MCP API unless explicitly called out in the release notes.

## Version Synchronization

Version metadata must remain synchronized across:

- `package.json`
- `pnpm-lock.yaml`
- `mcp.json`
- `server.json`
- `registry/mcp-ssh-tool/mcp.json`
- `src/mcp.ts`

Use `pnpm run sync-version` and `pnpm run sync-version -- --check`.

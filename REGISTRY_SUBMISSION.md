## MCP SSH Tool - Registry Submission

- **Repository:** https://github.com/oaslananka-lab/mcp-ssh-tool
- **NPM Package:** mcp-ssh-tool
- **Command:** `mcp-ssh-tool`
- **Entrypoint:** `dist/index.js`
- **Runtime:** node (`22.22.2+` or `24.15.0+`)
- **Transport:** stdio plus loopback Streamable HTTP metadata in `server.json`
- **Supported Platforms:** linux, macos, windows
- **Capabilities:** tools (true), resources (true), prompts (true)

### Minimal MCP client config

```jsonc
{
  "servers": {
    "ssh-mcp": {
      "type": "stdio",
      "command": "mcp-ssh-tool",
      "args": []
    }
  }
}
```

### Notes
- Build before use when installing from source: `npm ci && npm run build`.
- The registry metadata is published by the org `trusted-publish.yml` workflow after npm publication.
- stdio is the registry transport; Streamable HTTP remains available for explicit runtime use.
- Logs redact passwords/private keys/passphrases/sudo passwords by default.
- Exposes MCP resources for active sessions, metrics, policy, audit events, capability support, and configured SSH hosts.

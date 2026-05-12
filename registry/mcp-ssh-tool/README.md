## SSH MCP Tool (Registry Package)

- **Entrypoint:** `dist/index.js`
- **Transport:** stdio
- **Runtime:** node (`22.22.2+` or `24.15.0+`)
- **Platforms:** linux, macos, windows
- **Command:** `mcp-ssh-tool`

### Minimal client config

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

Build before use if installing from source:

```bash
npm install
npm run build
```

Registry publication is handled by the org `trusted-publish.yml` workflow after npm publication so the official MCP Registry version stays aligned with npm.

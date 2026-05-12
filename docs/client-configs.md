# Client Configs

## ChatGPT Developer Mode

Use stdio for local MCP clients. For ChatGPT app developer testing, use a public HTTPS MCP endpoint only after auth/origin/profile controls are configured.

Recommended remote profile:

```bash
SSH_MCP_TOOL_PROFILE=chatgpt
SSH_MCP_CONNECTOR_CREDENTIAL_PROVIDER=agent
SSH_MCP_ALLOWED_HOSTS=prod-1,prod-2
```

## Claude Desktop

```json
{
  "mcpServers": {
    "ssh-mcp": {
      "command": "mcp-ssh-tool",
      "args": []
    }
  }
}
```

## Claude Web Remote MCP

Claude Web custom connectors require a remotely reachable MCP URL. Use the restricted Claude profile and server-side credential broker:

```bash
SSH_MCP_TOOL_PROFILE=claude
SSH_MCP_CONNECTOR_CREDENTIAL_PROVIDER=agent
SSH_MCP_ALLOWED_HOSTS=prod-1,prod-2
```

See `docs/claude-connector.md` before exposing a public endpoint.

## VS Code, Cursor, and Codex

```json
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

## Streamable HTTP

```bash
printf '%s' 'dev-only-token' > .mcp-token
mcp-ssh-tool --transport=http --host 127.0.0.1 --port 3000 --bearer-token-file .mcp-token
```

Remote HTTP deployments must set:

```bash
SSH_MCP_HTTP_BEARER_TOKEN_FILE=/run/secrets/mcp-token
SSH_MCP_HTTP_ALLOWED_ORIGINS=https://your-client.example
SSH_MCP_ALLOWED_HOSTS=prod-1,prod-2
SSH_MCP_TOOL_PROFILE=remote-safe
```

Legacy SSE is disabled by default and should be used only for temporary compatibility.

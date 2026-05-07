# Docker

Docker is a secondary packaging path. npm remains the primary distribution channel.

## Local Build

```bash
docker build -t mcp-ssh-tool:local .
docker run --rm mcp-ssh-tool:local --version
docker run --rm mcp-ssh-tool:local --help
```

The production image:

- uses Node 24 Alpine
- installs dependencies with `npm ci`
- copies only built `dist`, runtime dependencies, docs, and registry metadata
- runs as the `node` user
- defaults to MCP stdio
- exposes port `3000` for explicit Streamable HTTP use
- includes a CLI healthcheck

## HTTP Container Example

Do not bind public HTTP without auth and origins:

```bash
printf '%s' 'change-me' > .mcp-token
docker run --rm -p 127.0.0.1:3000:3000 \
  -v "$PWD/.mcp-token:/run/secrets/mcp-token:ro" \
  mcp-ssh-tool:local \
  --transport=http \
  --host 127.0.0.1 \
  --port 3000 \
  --bearer-token-file /run/secrets/mcp-token
```

GHCR publishing is manual-only through `docker.yml` with `publish=true` and `APPROVE_CONTAINER_PUBLISH`.

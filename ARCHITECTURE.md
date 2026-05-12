# Architecture

`mcp-ssh-tool` is organized around a small dependency container and explicit service boundaries.

## Runtime Shape

```text
MCP transport
  -> SSHMCPServer
    -> ToolRegistry
      -> Tool providers
        -> Services
          -> SessionManager / SSH / SFTP / policy / metrics / audit
```

## Main Components

- `src/index.ts`: CLI entry point. Defaults to stdio and can start Streamable HTTP with `--transport=http`.
- `src/server-http.ts`: Streamable HTTP `/mcp` endpoint plus opt-in legacy SSE compatibility.
- `src/mcp.ts`: MCP server capabilities, resources, prompts, and tool-call handler wiring.
- `src/tools/*`: Provider-owned tool metadata, schemas, output schemas, annotations, and handlers.
- `src/tools/registry.ts`: Provider registry, compatibility aliases, `structuredContent`, and title normalization.
- `src/policy.ts`: Central enforcement for hosts, root, sudo, commands, paths, and destructive operations.
- `src/session.ts`: SSH connection lifecycle, host-key policy, SFTP availability, TTL, eviction, reconnect, and OS cache.
- `src/process.ts`: Command, sudo, shell wrapping, timeout handling, and policy checks.
- `src/fs-tools.ts`: SFTP-first file operations with size limits and POSIX/BusyBox-aware fallbacks.
- `src/transfer.ts`: SFTP upload/download with SHA-256 verification.
- `src/tunnel.ts`: SSH local and remote forwarding with lifecycle accounting.
- `src/metrics.ts`, `src/audit.ts`, `src/telemetry.ts`: Observability surfaces.

## Design Decisions

- **Transport is separate from core logic.** Stdio and HTTP runners connect to the same `SSHMCPServer`.
- **Policy is centralized.** Tools and services do not hand-roll destructive-operation checks.
- **Config must be real.** Documented limits and flags are enforced in service code.
- **SFTP is preferred.** Shell fallback exists for portability, not as the default path.
- **Outputs are stable.** Tool calls return text and `structuredContent`; metadata includes annotations and output schemas.
- **Compatibility is explicit.** Legacy SSE and deprecated strict-host-key booleans remain for one v2 cycle but are not the recommended path.

## Adding A Tool

1. Add or extend a provider in `src/tools`.
2. Define a Zod input schema in `src/types.ts` or the provider.
3. Add output schema and annotations.
4. Call policy before mutation, privilege escalation, transfers, or tunnels.
5. Return a stable object suitable for `structuredContent`.
6. Add unit tests for schema, metadata, success, policy denial, and failure paths.

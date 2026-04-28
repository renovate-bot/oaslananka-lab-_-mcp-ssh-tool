# Operations

## Repository Operations

- Canonical source: `https://github.com/oaslananka/mcp-ssh-tool`
- Automation and release boundary: `https://github.com/oaslananka-lab/mcp-ssh-tool`
- Local Azure remote in some checkouts may be named `origin`; use `github` for canonical GitHub pushes.

Create release hardening branches from canonical source:

```bash
git switch -c chore/v2.1.0-hardening
git push -u github chore/v2.1.0-hardening
```

The org repository should be updated by running `Sync From Canonical` in `oaslananka-lab/mcp-ssh-tool`, not by personal-repo push workflows.

## Runtime Operations

Prefer stdio for local MCP clients. Use Streamable HTTP only when a remote client or reverse proxy requires HTTP, and keep HTTP bound to loopback unless bearer auth and allowed origins are configured.

Before privileged or destructive host changes:

1. Open a strict host-key session.
2. Inspect `mcp-ssh-tool://policy/effective`.
3. Use `policyMode: "explain"` for mutation planning.
4. Prefer `ensure_*` tools over raw `proc_sudo`.
5. Close sessions and tunnels when finished.

## Generated Files

Cleanup is dry-run by default:

```bash
bash scripts/repo-cleanup.sh
```

Only maintainers should run:

```bash
bash scripts/repo-cleanup.sh --apply
```

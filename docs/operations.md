# Operations

## Repository Operations

- Source repository and local `origin`: `https://github.com/oaslananka/mcp-ssh-tool`
- CI/CD, release, and security boundary: `https://github.com/oaslananka-lab/mcp-ssh-tool`
- Push the same reviewed branch content to the org remote for GitHub Actions verification.

Create maintenance branches from synchronized `main`, then publish them to the org remote for checks:

```bash
git switch -c chore/v2.1.2-hardening
git push -u lab chore/v2.1.2-hardening
```

Personal-repo Actions are intentionally disabled. Org workflows are repository-guarded, and `mirror-personal.yml` backfills org release results to the personal source repository.

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

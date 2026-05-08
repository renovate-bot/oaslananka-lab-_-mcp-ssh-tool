# Doppler Secrets

GitHub Actions stores the bootstrap `DOPPLER_TOKEN` directly. `PERSONAL_REPO_PUSH_TOKEN` is a GitHub secret for the dedicated mirror workflow. Codecov, MCP Registry publisher identity, and Safety runtime values live in Doppler and are injected at runtime with `doppler run`.

## Inventory

The tracked inventory is `.doppler/secrets.txt`:

- `CODECOV_TOKEN`
- `DOPPLER_GITHUB_SERVICE_TOKEN`
- `SAFETY_API_KEY`

`DOPPLER_PROJECT` defaults to `all` and `DOPPLER_CONFIG` defaults to `main` in local scripts and workflows.

## Verify Locally

Bash:

```bash
bash scripts/verify-doppler-secrets.sh
```

PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/verify-doppler-secrets.ps1
```

For local development, `task doppler:check` validates the tracked inventory without requiring access to production Doppler secrets. Use the scripts directly for strict live verification.

## Workflow Use

- CI uploads Codecov coverage through `doppler run` so `CODECOV_TOKEN` never becomes a GitHub secret.
- MCP Registry publication for the already-published `io.github.oaslananka/mcp-ssh-tool` namespace uses `DOPPLER_GITHUB_SERVICE_TOKEN` from Doppler only.
- Safety integration validates `SAFETY_API_KEY` injection through Doppler.

Do not add Doppler-managed values directly to GitHub repository or environment secrets.

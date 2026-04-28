# Doppler Secrets

GitHub Actions stores only the bootstrap `DOPPLER_TOKEN`. All other workflow secrets live in Doppler and are injected at runtime with `doppler run`.

## Inventory

The tracked inventory is `.doppler/secrets.txt`:

- `CODECOV_TOKEN`
- `DOPPLER_GITHUB_SERVICE_TOKEN`
- `NPM_TOKEN`
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
- Emergency npm publish uses `NPM_TOKEN` from Doppler only.
- Release-back mirroring uses `DOPPLER_GITHUB_SERVICE_TOKEN` from Doppler only.
- Safety integration validates `SAFETY_API_KEY` injection through Doppler.

Do not add these values directly to GitHub repository or environment secrets.

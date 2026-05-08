# Publishing

Source history lives in `https://github.com/oaslananka/mcp-ssh-tool`. Publishing authority lives only in `https://github.com/oaslananka-lab/mcp-ssh-tool`.

## Distribution Channels

| Channel | Current status | Authority |
|---------|----------------|-----------|
| npm package `mcp-ssh-tool` | Published | Org `release.yml` |
| MCP Registry server `io.github.oaslananka/mcp-ssh-tool` | Published and active | Release metadata only; registry publish remains separate until official publisher automation is re-enabled |
| GitHub Releases | Org only | Org `release.yml` |
| GHCR image | Optional semver tag publish only | Org `docker.yml` |
| Personal repository | Source repository; Actions disabled | Org `mirror-personal.yml` backfills release refs |
| ChatGPT app | Readiness scaffold only | No publish workflow |

## Manual Gates

Live release publishing must require:

- release-please release PR merge
- version and tag from release-please outputs
- `pnpm run check`
- npm pack validation
- SBOM and SHA256 generation
- artifact attestation
- post-publish verification

Manual version inputs, manual tags, and manual changelog edits are not release paths.

## Never Publish From

- the personal repository Actions runtime
- fork pull requests
- untrusted `pull_request_target` code
- dependency update automation
- ChatGPT app readiness checks

## Secrets

Trusted npm publishing should not use `NPM_TOKEN`. `NPM_TOKEN` is emergency fallback only through Doppler and must not be committed in `.npmrc` or printed in logs.

MCP Registry publication currently remains a separate controlled step because the published `io.github.oaslananka/*` namespace must not be changed without an official migration path. If the official registry supports safe namespace migration or aliases in the future, document and test that migration before changing `server.json#name`.

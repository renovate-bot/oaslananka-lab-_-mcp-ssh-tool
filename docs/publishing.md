# Publishing

Publishing authority lives only in `https://github.com/oaslananka-lab/mcp-ssh-tool`.

## Distribution Channels

| Channel | Current status | Authority |
|---------|----------------|-----------|
| npm package `mcp-ssh-tool` | Published, latest `2.1.1` | Org `trusted-publish.yml` |
| MCP Registry server `io.github.oaslananka/mcp-ssh-tool` | Published and active, latest `2.1.1` | Org `trusted-publish.yml` |
| GitHub Releases | Org only | Org `trusted-publish.yml` |
| GHCR image | Optional manual publish only | Org `docker.yml` |
| Personal repository | Showcase mirror only | Org `mirror-personal.yml` |
| ChatGPT app | Readiness scaffold only | No publish workflow |

## Manual Gates

Live publishing must require:

- maintainer review
- environment approval
- version match against `package.json`
- npm already-published check
- MCP Registry already-published check
- `npm run check`
- npm pack validation
- SBOM and SHA256 generation
- artifact attestation
- post-publish verification

The default target is dry-run. `AUTO_RELEASE_PUBLISH=false`, `AUTO_RELEASE_TARGET=dry-run`, and `CHATGPT_APP_PUBLISH=false` are expected repository variables.

## Never Publish From

- the personal showcase repository
- fork pull requests
- untrusted `pull_request_target` code
- Jules automation
- dependency update automation
- ChatGPT app readiness checks

## Secrets

Trusted npm publishing should not use `NPM_TOKEN`. `NPM_TOKEN` is emergency fallback only through Doppler and must not be committed in `.npmrc` or printed in logs.

MCP Registry publication currently uses the published `io.github.oaslananka/*` namespace and therefore retains the existing GitHub-token publisher path. If the official registry supports safe namespace migration or aliases in the future, document and test that migration before changing `server.json#name`.

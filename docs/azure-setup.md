# Azure DevOps Setup Guide

Azure DevOps is a manual validation backup for `mcp-ssh-tool`. Automatic CI/CD and release ownership live in the GitHub organization repository at `https://github.com/oaslananka-lab/mcp-ssh-tool`.

## Pipeline Policy

- Do not enable branch triggers.
- Do not enable pull-request triggers.
- Use Azure manually for extra validation and artifact generation only.
- Use the org GitHub `release.yml` workflow for release-please, GitHub Releases, npm trusted publishing, SBOMs, checksums, and attestations.

## Pipelines

Create these pipelines from existing YAML:

| Pipeline | YAML | Trigger |
|----------|------|---------|
| Manual CI validation | `.azure/pipelines/ci.yml` | Manual |
| Manual release validation | `.azure/pipelines/publish.yml` | Manual |
| Manual release record | `.azure/pipelines/mirror.yml` | Manual |

## Environment

Create an Azure environment named `npm-production` only if the manual validation pipeline needs environment approval parity.

Recommended controls:

- Require approval from the release owner.
- Restrict who can manually run the publish validation pipeline.
- Retain validation artifacts for release review.

## Service Connections

Only create service connections that are required for the manual pipeline you are using.

### GitHub Connection

Optional. Azure must not create release tags, GitHub Releases, or package publishes.

1. Open Project Settings -> Service connections -> New service connection.
2. Choose GitHub.
3. Use a fine-scoped token with repository access only for the intended repository.
4. Name the connection `GitHub` to match the pipeline YAML.

## Release Validation

1. Run `.azure/pipelines/publish.yml` manually.
2. Confirm lint, tests, build, release dry-run, package contents, SBOM, and package hashes complete successfully.
3. Merge release-relevant changes through GitHub only after required checks are green.

The org GitHub release workflow is intentionally repository-gated and will only publish from `oaslananka-lab`.

# npm Provenance

The npm package name is `mcp-ssh-tool` and must not be renamed.

## Trusted Publisher

The primary release path uses npm trusted publishing from GitHub Actions. npm trusted publishing requires an OIDC-capable hosted runner and `id-token: write` on the live publish job. The package `repository.url` must match the GitHub repository used for publishing:

```json
{
  "repository": {
    "type": "git",
    "url": "git+https://github.com/oaslananka-lab/mcp-ssh-tool.git"
  }
}
```

`trusted-publish.yml` keeps the `npm-production` environment because existing npm trusted publisher configuration may bind to the exact environment name. Move to the `release` environment only after updating npm package settings.

## Provenance Verification

After a trusted publish:

```bash
npm view mcp-ssh-tool version repository homepage bugs dist-tags --json
npm view mcp-ssh-tool@2.1.1 dist.integrity dist.tarball --json
```

Use the npm package page to verify provenance for the published version. GitHub artifact attestations verify the tarball and SBOM produced by the org workflow.

## Token Fallback

`NPM_TOKEN` is allowed only for `publish.yml`, the emergency fallback workflow. It should be injected through Doppler, not stored in `.npmrc`, and not used by the trusted-publishing workflow.

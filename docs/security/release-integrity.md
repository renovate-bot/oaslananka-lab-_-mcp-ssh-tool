# Release Integrity

Release integrity depends on the org repository:

- org-only workflow guards
- least-privilege `GITHUB_TOKEN` permissions
- environment approval for live release jobs
- npm trusted publishing without `NPM_TOKEN`
- SBOM generation
- SHA256 files for release artifacts
- GitHub artifact attestations for npm tarball and SBOM
- MCP Registry post-publish verification
- no personal repository release mirror

Consumers can verify release assets with:

```bash
sha256sum -c mcp-ssh-tool-<version>.tgz.sha256
gh attestation verify mcp-ssh-tool-<version>.tgz -R oaslananka-lab/mcp-ssh-tool
```

The personal repository is not an attestation or provenance authority.

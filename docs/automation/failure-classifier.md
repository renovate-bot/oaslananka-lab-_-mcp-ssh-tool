# Failure Classifier

`scripts/classify-gh-failure.mjs` converts failed job logs into repository-specific failure classes.

Each class returns:

- root cause
- recommended fix
- whether automatic repair is allowed
- whether human approval is required
- whether release or publish must stop

## Local Use

```bash
node scripts/classify-gh-failure.mjs --help
node scripts/classify-gh-failure.mjs --log-file failed.log --json
node scripts/classify-gh-failure.mjs --class mcp-metadata-drift
```

## Classes

The classifier recognizes:

- `npm-trusted-publisher-mismatch`
- `npm-package-upload-includes-non-package-assets`
- `mcp-registry-auth-mismatch`
- `mcp-registry-schema-error`
- `mcp-metadata-drift`
- `package-version-drift`
- `chatgpt-app-manifest-invalid`
- `sigstore-uv-config-conflict`
- `workflow-syntax`
- `actionlint`
- `zizmor`
- `dependency-cache/restore issue`
- `CodeQL finding`
- `Gitleaks finding`
- `Trivy finding`
- `test failure`
- `typecheck failure`
- `lint failure`
- `npm audit failure`
- `Docker build error`
- `SSH policy regression`
- `HTTP auth/origin regression`
- `personal-mirror-tag-clobber`
- `personal-mirror-branch-divergence`
- `flaky/infra failure`

Unknown failures default to `humanApprovalRequired=true` and `releasePublishMustStop=true`.

## Automation Policy

`actions-maintenance.yml` may rerun only classes that are explicitly infrastructure-only. Publish, release, MCP Registry, GHCR, ChatGPT app, and mirror force operations are never retried automatically by the classifier.

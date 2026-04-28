# Development

Use the Node and npm versions pinned by `.node-version`, `.nvmrc`, and `package.json#packageManager`.

```bash
corepack enable
node scripts/use-ci-npm.mjs
npm ci
npm run prepare
```

On Windows, `corepack enable` may require elevated permissions because it writes shims under the Node.js installation directory. If it fails with `EPERM`, continue with the repo-pinned npm installed by `node scripts/use-ci-npm.mjs`.

## Local Gates

Run the full local parity gate before pushing:

```bash
task ci
```

The task expands to formatting, linting, type checking, coverage, audit, license checks, build, version sync check, package content check, workflow guard/lint checks, local Doppler inventory validation, CycloneDX SBOM generation, and `npm pack --dry-run`.

Optional local security tools are best-effort:

```bash
task security:local
```

Missing tools such as `actionlint`, `zizmor`, `gitleaks`, `trivy`, `hadolint`, `osv-scanner`, `safety`, or `doppler` should be recorded as caveats rather than weakening CI requirements.

## Hooks

`npm run prepare` configures `core.hooksPath=.githooks`. The tracked hooks run existing npm hook scripts and then invoke `.pre-commit-config.yaml` through `pre-commit` when that binary is installed.

```bash
task hooks
```

This keeps npm hook behavior and pre-commit behavior active even though Git is not using `.git/hooks`.

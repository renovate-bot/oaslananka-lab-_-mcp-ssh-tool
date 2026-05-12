# Development

Use the Node and pnpm versions pinned by `.node-version`, `.nvmrc`, and `package.json#packageManager`.
pnpm 11 settings, including dependency build-script approvals, live in `pnpm-workspace.yaml`.

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm run prepare
```

On Windows, `corepack enable` may require elevated permissions because it writes shims under the Node.js installation directory. If it fails with `EPERM`, continue with the repo-pinned pnpm activated by `corepack prepare pnpm@11.0.9 --activate`.

## Local Gates

Run the full local parity gate before pushing:

```bash
task ci
```

The task expands to formatting, linting, type checking, coverage, audit, license checks, build, version sync check, package content check, workflow guard/lint checks, local Doppler inventory validation, CycloneDX SBOM generation, and `pnpm pack --dry-run`.

Optional local security tools are best-effort:

```bash
task security:local
```

Missing tools such as `actionlint`, `zizmor`, `gitleaks`, `trivy`, `hadolint`, `osv-scanner`, `safety`, or `doppler` should be recorded as caveats rather than weakening CI requirements.

## Dependency Overrides

Keep overrides narrow and documented. Current overrides pin transitive HTTP/protobuf packages to patched versions used by `@modelcontextprotocol/sdk`:

- `hono`
- `@hono/node-server`
- `express-rate-limit`
- `ip-address`
- `protobufjs`

Run `pnpm audit --audit-level moderate` after changing any override.

## Hooks

`pnpm run prepare` configures `core.hooksPath=.githooks`. The tracked hooks run existing pnpm hook scripts and then invoke `.pre-commit-config.yaml` through `pre-commit` when that binary is installed.

```bash
task hooks
```

This keeps pnpm hook behavior and pre-commit behavior active even though Git is not using `.git/hooks`.

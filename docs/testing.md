# Testing Guide - mcp-ssh-tool

## Overview

mcp-ssh-tool uses **Jest** with **TypeScript**. Tests are in three layers:

| Layer | Command | Path | Requirements |
|---|---|---|---|
| Unit | `pnpm test` | `test/unit/` | None |
| Integration | `pnpm run test:integration` | `test/integration/` | Docker (SSH server) |
| E2E | `pnpm run test:e2e` | `test/e2e/` | Docker (SSH server) |

## Running Tests Locally

```bash
# Unit tests only (fast, no Docker)
pnpm test

# With coverage
pnpm run test:coverage

# Integration (requires Docker)
pnpm run integration:docker

# E2E (requires Docker)
pnpm run e2e:docker
```

## Docker SSH Server

Integration and E2E tests connect to a real SSH server via Docker Compose:

```bash
docker compose up -d ssh-server
# Run tests
docker compose down
```

The SSH server config is in `docker-compose.yml`. Test credentials are in
`Dockerfile.test`; these are **test-only** credentials, never use in production.

## CI Matrix

| CI Job | Node | OS |
|---|---|---|
| Unit Tests | 22, 24 | ubuntu-24.04 |
| Integration | 24 | ubuntu-24.04 |
| E2E | 24 | ubuntu-24.04 |

## Security in Tests

- `src/safety.ts` has allow/deny-list logic; test with `test/unit/safety.test.ts`
- `src/auth.ts` key validation; see `test/unit/auth.test.ts`
- Never commit real SSH keys or credentials

## Adding a Test

1. Pick the correct layer.
2. Create `test/<layer>/<module>.test.ts`.
3. Follow Arrange-Act-Assert.
4. Run `pnpm test -- --testPathPatterns=<file>` locally.
5. Ensure `pnpm run lint` and `pnpm run typecheck` pass.

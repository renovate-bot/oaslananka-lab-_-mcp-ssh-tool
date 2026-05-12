# Contributing to mcp-ssh-tool

Thank you for your interest in contributing to mcp-ssh-tool! This document provides guidelines and information for contributors.

## Development Setup

### Prerequisites

- Node.js 24.15.0 LTS for local development (`.nvmrc` and `.node-version` are included)
- pnpm 11.0.9 through Corepack
- Git

### Getting Started

1. Fork the repository
2. Clone your fork:

   ```bash
   git clone https://github.com/YOUR_USERNAME/mcp-ssh-tool.git
   cd mcp-ssh-tool
   ```

3. Install dependencies:

   ```bash
   corepack enable
   corepack prepare pnpm@11.0.9 --activate
   pnpm install --frozen-lockfile
   ```

4. Build the project:

   ```bash
   pnpm run build
   ```

5. Run tests:

   ```bash
   pnpm test
   ```

## Development Workflow

### Branch Naming

- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation changes
- `refactor/` - Code refactoring
- `test/` - Test additions/changes

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

Types:

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting
- `refactor`: Code restructuring
- `test`: Adding tests
- `chore`: Maintenance

Examples:

```
feat(session): add auto-reconnect capability
fix(auth): handle SSH agent timeout
docs(readme): update installation instructions
```

### Code Style

- Use TypeScript
- Follow ESLint rules
- Format with Prettier
- Add JSDoc comments for public APIs

### Testing

- Write tests for new features
- Maintain test coverage
- Run `pnpm run check` before opening a PR
- Run `pnpm run test:integration` when the change affects SSH runtime behavior or MCP server wiring

### Local Quality Gates

- `pre-commit` runs fast staged-file checks: Prettier plus staged TypeScript linting
- `pre-push` runs `pnpm run check:push`
- `pnpm run check` is the local equivalent of the primary CI quality/package verification path

### Pull Request Process

1. Create a feature branch
2. Make your changes
3. Add/update tests
4. Update documentation
5. Run linter and tests
6. Submit PR with clear description

## Continuous Integration (CI)

Primary automated CI/CD runs in the GitHub org mirror `oaslananka-lab/mcp-ssh-tool`, with Azure DevOps kept as a manual validation/release-control backup.

- `.github/workflows/ci.yml` is the source-of-truth parity workflow for quality, tests, integration, and package verification
- `.github/workflows/security.yml` handles CodeQL and dependency review in the org mirror
- `/.azure/pipelines/ci.yml` and `/.azure/pipelines/publish.yml` remain manual-only backup validation paths
- Personal GitHub workflows are manual-only fallback paths

## Releasing

Primary release automation runs from the GitHub org repository with release-please manifest mode.

1. Use Conventional Commits for user-visible changes.
2. Run quality gates locally: `pnpm run check`.
3. If SSH/runtime behavior changed, run `pnpm run test:integration`.
4. Merge the change to `main`.
5. Let `release.yml` create or update the release-please PR.
6. Merge the generated release PR after CI passes.
7. Let the release workflow create the tag, GitHub Release, SBOM, checksums, attestations, and npm publish from release-please outputs.

Do not create release tags, edit `CHANGELOG.md`, or bump versions manually.

## Project Structure

```
mcp-ssh-tool/
├── src/
│   ├── index.ts        # Entry point
│   ├── container.ts    # Dependency injection wiring
│   ├── mcp.ts          # MCP server shell and registry wiring
│   ├── tools/          # Tool providers and registry
│   ├── session.ts      # SSH session management
│   ├── process.ts      # Command execution
│   ├── fs-tools.ts     # File operations
│   ├── ensure.ts       # Package/service management
│   ├── detect.ts       # OS detection
│   ├── ssh-config.ts   # SSH config parsing
│   ├── safety.ts       # Safety warnings
│   ├── types.ts        # TypeScript types
│   ├── errors.ts       # Error handling
│   └── logging.ts      # Logging utilities
├── test/
│   ├── unit/           # Unit tests
│   └── e2e/            # E2E tests
└── dist/               # Generated locally; not committed
```

## Adding New Features

### Adding a New MCP Tool

1. Define or reuse the schema in `src/types.ts`
2. Create or update a provider in `src/tools/`
3. Register the provider in `src/tools/index.ts`
4. Add tests in `test/unit/tools/`
5. Update documentation

### Adding a New MCP Resource

1. Add the resource definition in `src/resources.ts`
2. Extend `readResource()` to return the new payload
3. Add unit coverage in `test/unit/resources.test.ts`
4. Add an integration assertion in `test/integration/mcp.integration.test.ts` if the resource depends on live runtime state

### Adding New Dependencies

- Evaluate necessity carefully
- Prefer lightweight packages
- Check for security vulnerabilities
- Update `package.json` appropriately

## Questions?

- Open an issue for bugs or feature requests
- Start a discussion for questions
- Check existing issues before creating new ones

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

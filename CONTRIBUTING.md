# Contributing to mcp-ssh-tool

Thank you for your interest in contributing to mcp-ssh-tool! This document provides guidelines and information for contributors.

## Development Setup

### Prerequisites

- Node.js 20 or later
- npm 9 or later
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
   npm install
   ```

4. Build the project:

   ```bash
   npm run build
   ```

5. Run tests:

   ```bash
   npm test
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
- Run `npm test` before submitting
- Run `npm run test:integration` when the change affects SSH runtime behavior or MCP server wiring

### Pull Request Process

1. Create a feature branch
2. Make your changes
3. Add/update tests
4. Update documentation
5. Run linter and tests
6. Submit PR with clear description

## Continuous Integration (CI)

Primary CI/CD runs on Azure DevOps under `/.azure/pipelines/`.

- `ci.yml` handles quality checks, tests, coverage publishing, and builds
- `publish.yml` handles Azure-based release validation and npm publish flow
- `mirror.yml` is used for GitHub release mirroring from Azure

GitHub Actions is intentionally **manual-only** for emergency fallback publishing.

## Releasing

Primary release automation runs via Azure DevOps.

1. Create a changeset for user-visible work: `npm run changeset`
2. When preparing a release, apply pending changesets: `npm run changeset:version`
3. Review the generated version bump, then run `npm run sync-version`
4. Run quality gates locally: `npm run lint`, `npm test`, `npm run test:integration`, `npm run build`
5. Commit and push the versioned changes.
6. Create and push a tag: `git tag v1.3.4 && git push origin v1.3.4`

Azure publish validation checks:

- `package.json`, `mcp.json`, `server.json`, registry metadata, and `src/mcp.ts` version consistency
- test and build health before publish

GitHub Actions `publish.yml` should be used only if Azure DevOps is unavailable and a manual hotfix publish is required.

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
└── dist/               # Compiled output
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

# SSH and MCP Security Gates

The SSH/MCP surface is high-impact. CI and review automation must treat these checks as blocking when source, policy, transport, or tool metadata changes.

## Blocking Areas

- strict host-key verification remains the default
- `known_hosts` and pinned host-key behavior remain explicit
- root login remains denied unless policy allows it
- raw `proc_sudo` remains denied unless policy allows it
- destructive command patterns remain policy-controlled
- destructive filesystem operations remain path-policy-controlled
- local and remote path traversal is denied
- private keys, passwords, passphrases, bearer tokens, cookies, policy files, and command-output secrets are redacted
- session TTL, cleanup, concurrency, and rate limiting remain bounded
- non-loopback Streamable HTTP startup requires bearer auth and allowed origins
- origin checks reject unapproved origins
- legacy SSE remains compatibility-only behind an explicit flag
- MCP tool annotations accurately describe read-only, destructive, idempotent, and open-world behavior
- resources and prompts keep stable URIs/names and do not expose secrets

## Targeted Local Checks

Run targeted unit tests when these surfaces change:

```bash
pnpm test -- --runTestsByPath test/unit/policy.test.ts
pnpm test -- --runTestsByPath test/unit/http-security.test.ts
pnpm test -- --runTestsByPath test/unit/transfer.test.ts
pnpm test -- --runTestsByPath test/unit/logging.test.ts
pnpm test -- --runTestsByPath test/unit/tools/registry.test.ts
pnpm test -- --runTestsByPath test/unit/resources.test.ts
pnpm test -- --runTestsByPath test/unit/prompts.test.ts
```

Run the full gate before marking a PR ready:

```bash
pnpm run check
```

## Automation Boundary

Contributors may add tests that preserve these guarantees. Changes must not weaken host-key verification, path policy, sudo/destructive policy, HTTP bearer auth, allowed origins, redaction, or tool annotations without maintainer review.

# Agent Review Fix Loop

`agent-review-fix-loop.yml` is a guarded maintainer-invoked repair loop for actionable unresolved PR review threads.

## Triggers

The workflow can be started by:

- manual `workflow_dispatch` with a PR number
- a trusted actor comment containing `/agent-review-fix`
- a trusted actor pull request review body containing `/agent-review-fix`
- a trusted actor review comment containing `/agent-review-fix`
- the `agent:fix-review` label on a PR when a trusted review event occurs

The current trusted actor allowlist is `oaslananka`.

## Guards

The workflow refuses to invoke Jules when:

- the repository is not `oaslananka-lab/mcp-ssh-tool`
- the actor is not trusted
- the PR head repository is not the same repository
- the branch is missing or is a Jules loop branch
- the workflow has already run three times for the PR branch
- `JULES_API_KEY` is not configured
- no actionable unresolved review threads exist

It does not use `pull_request_target`, does not run fork code with secrets, and does not approve, merge, publish, release, mirror, or modify secrets.

## Repair Contract

The generated Jules prompt instructs the agent to:

- inspect unresolved, not-outdated actionable review threads
- prefer human review over bot review
- parse GitHub suggestion blocks
- apply the smallest safe source, workflow, test, or documentation fix
- run targeted tests and cheap gates
- preserve SSH strict host-key verification, sudo/destructive policy controls, path traversal protections, HTTP bearer auth, and allowed-origin checks
- avoid printing secrets, credentials, tokens, private keys, command-output secrets, or policy files
- leave a PR comment summarizing threads inspected, fixes applied, tests run, and remaining unresolved threads

Human review threads are not auto-resolved. Security-sensitive bot threads are not auto-resolved by automation.

## Safe Boundaries

Allowed automatic fixes are limited to formatting, lint, metadata drift, version sync drift, safe test fixture updates, docs link drift, and narrow workflow mistakes. Anything involving npm trusted publisher setup, MCP Registry auth, ChatGPT app publishing credentials, GitHub environment protection, branch protection, permissions broadening, release enablement, SSH policy weakening, HTTP auth/origin weakening, or destructive mirror repair requires maintainer review.

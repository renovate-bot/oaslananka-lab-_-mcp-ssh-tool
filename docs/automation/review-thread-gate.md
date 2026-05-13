# Review Thread Gate

`review-thread-gate.yml` blocks actionable unresolved review threads before a PR is treated as ready. It is a cheap gate and is intended to run on draft PRs.

The workflow uses `scripts/check-review-threads.mjs`, which reads GitHub GraphQL `PullRequestReviewThread` data and never resolves or unresolves threads. It fetches:

- pull request id, URL, and draft state
- review thread id, resolved state, outdated state, path, line, original line, and diff side
- review comments with author, body, URL, created time, and updated time

## Classification Rules

The gate ignores:

- resolved threads
- outdated threads
- pure informational bot comments

The gate blocks:

- every unresolved, not-outdated human review thread
- unresolved, not-outdated bot threads containing security, correctness, release, workflow, secret, SSH, npm, MCP Registry, ChatGPT app, credential, private-key, host-key, command-injection, path-traversal, or GitHub suggestion wording

The script redacts token-like and private-key-like strings before writing `review-thread-summary.json` or the job summary.

## Labels

When actionable threads exist:

- add `review:blocked`
- add `ci:hold`
- remove `review:clean`
- remove `ci:ready`

When no actionable threads exist:

- add `review:clean`
- add `ci:ready`
- remove `review:blocked`
- remove `ci:hold`

The workflow creates those labels if they are missing.

## Local Use

```bash
GH_TOKEN=... node scripts/check-review-threads.mjs \
  --repo oaslananka-lab/mcp-ssh-tool \
  --pr 123 \
  --summary-file review-thread-summary.json \
  --json \
  --fail-on-actionable
```

`GH_TOKEN` or `GITHUB_TOKEN` needs pull request read access. The script is read-only and is safe for diagnostics.

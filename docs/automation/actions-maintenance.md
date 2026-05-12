# Actions Maintenance

`actions-maintenance.yml` is manual-only repository operations maintenance.

It can:

- list recent failed workflow runs
- classify a failed run with `scripts/classify-gh-failure.mjs`
- cancel superseded in-progress or queued PR runs
- rerun infrastructure-only failures
- print `scripts/release-state.mjs` output

It cannot:

- publish npm packages
- publish MCP Registry metadata
- publish GHCR images
- create or delete GitHub Releases
- publish ChatGPT apps
- delete tags
- force mirror refs
- modify secrets
- approve or merge PRs

## Modes

`list-failed-runs` lists recent failed runs.

`classify-run` requires `run_id` and prints a JSON failure classification.

`cancel-superseded-pr-runs` requires `pr_number`. It defaults to `dry_run=true`; `dry_run=false` cancels queued or in-progress runs on that PR branch except the maintenance run itself.

`rerun-infra-only` requires `run_id`. It reruns only when the classifier returns `flaky/infra failure` or `dependency-cache/restore issue`.

`release-state` runs the read-only release state machine.

## Local Equivalents

```bash
gh run list --repo oaslananka-lab/mcp-ssh-tool --status failure --limit 20
gh run view <RUN_ID> --repo oaslananka-lab/mcp-ssh-tool --log-failed > failed.log
node scripts/classify-gh-failure.mjs --log-file failed.log --json
node scripts/release-state.mjs --repo oaslananka-lab/mcp-ssh-tool
```

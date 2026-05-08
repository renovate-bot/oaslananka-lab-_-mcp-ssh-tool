# Personal Source Backfill

`mirror-personal.yml` backfills release-generated org refs to the personal source repository:

- source: `https://github.com/oaslananka/mcp-ssh-tool`
- automation boundary: `https://github.com/oaslananka-lab/mcp-ssh-tool`

The personal repository remains the source repository. The org repository runs GitHub Actions, release-please, attestations, and publish checks because personal-repo Actions are intentionally disabled.

## Automatic Mode

On org `main` pushes and release tag pushes matching `v*.*.*` or `mcp-ssh-tool-v*`, the workflow:

- preflights personal `main`
- fast-forwards personal `main` only when safe
- pushes missing release tags
- reports extra personal tags without deleting them
- refuses divergent branch or tag rewrites

Backfill failure means the two repositories are no longer identical and must be audited before force repair. Do not rewrite personal refs without an exact printed ref plan.

## Manual Dry Run

Manual dispatch defaults to `dry_run=true`.

```bash
gh workflow run mirror-personal.yml \
  --repo oaslananka-lab/mcp-ssh-tool \
  --field dry_run=true \
  --field force_mirror=false \
  --field ref_scope=main-and-tags \
  --field approval=DRY_RUN
```

## Divergent Tag Repair

When a personal tag diverges, the workflow fails with:

```text
Personal source tag <tag> diverges from org automation tag. Run mirror-personal.yml with force_mirror=true, ref_scope=tags, approval=MIRROR_AUTOMATION_TO_SOURCE.
```

Force repair requires:

- `workflow_dispatch`
- `force_mirror=true`
- `approval=MIRROR_AUTOMATION_TO_SOURCE`
- `--force-with-lease`
- an exact printed ref plan

The workflow never deletes tags and never force-pushes without explicit maintainer approval.

## Required Secret

`PERSONAL_REPO_PUSH_TOKEN` must allow pushing to the personal source repository. The token must never be printed and is not used by release or publish workflows.

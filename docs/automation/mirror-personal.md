# Personal Showcase Mirror

`mirror-personal.yml` mirrors canonical org refs to the personal showcase repository:

- canonical: `https://github.com/oaslananka-lab/mcp-ssh-tool`
- showcase mirror: `https://github.com/oaslananka/mcp-ssh-tool`

The mirror is advisory. It is not an npm, MCP Registry, GitHub Release, GHCR, or ChatGPT app release authority.

## Automatic Mode

On canonical `main` pushes and `v*.*.*` tag pushes, the workflow:

- preflights personal `main`
- fast-forwards personal `main` only when safe
- pushes missing `v*.*.*` tags
- reports extra personal tags without deleting them
- refuses divergent branch or tag rewrites

Mirror failure must not be treated as a release authority failure. The org repository remains authoritative.

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
Personal showcase tag <tag> diverges from canonical. Run mirror-personal.yml with force_mirror=true, ref_scope=tags, tag_name=<tag>, approval=MIRROR_CANONICAL_TO_PERSONAL.
```

Force repair requires:

- `workflow_dispatch`
- `force_mirror=true`
- `approval=MIRROR_CANONICAL_TO_PERSONAL`
- `--force-with-lease`
- an exact printed ref plan

The workflow never deletes tags and never force-pushes without explicit maintainer approval.

## Required Secret

`PERSONAL_REPO_PUSH_TOKEN` must allow pushing to the personal showcase repository. The token must never be printed and is not used by release or publish workflows.

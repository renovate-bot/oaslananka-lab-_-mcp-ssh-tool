# Changesets

`mcp-ssh-tool` uses Changesets to track semantic version intent before publish.

## Typical Maintainer Flow

1. Create a changeset for any user-visible change:

   ```bash
   npm run changeset
   ```

2. Merge the change to `main`.

3. When you are ready to cut a release, apply queued changesets:

   ```bash
   npm run changeset:version
   ```

4. Review the generated version bumps, run the normal quality gates, then tag and publish through the existing Azure/npm workflow.

Changesets complements the existing `sync-version` script; it does not replace MCP metadata synchronization.

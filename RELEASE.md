# Release flow

- Pushes to `develop`, `staging`, and `main` create immutable `release/<branch>/v<version>-<sha>` tags.
- Publishing runs only from release tags.
- Source content is synced by `a5c-ai/babysitter` via `scripts/sync-external-plugin-repos.mjs`.

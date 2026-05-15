# issues/archive/

Shipped (or cancelled) issues live here. One file per merged PR — the same `<id>-<slug>.md` file that was originally in `issues/`, moved as part of the PR that flipped `status:` to `done`.

## Why archive instead of leave in place

- Keeps `rg "^status: open" issues/*.md` clean as the queue grows.
- Removes stale work specs from the line of sight of agents picking the next task.
- Git `--follow` preserves the file's history across the rename, so the audit trail is intact.

## Why archive instead of delete

- Decision archaeology: an open issue may say "see how 13.1 chose to shape the envelope" and an archive lookup is faster than reading commit messages.
- The design rationale frequently outlives the issue — the file stays useful as long as the corresponding `features/extension/<n>-...md` is cited.

## Lifecycle

When a PR merges:

1. The same commit that flips `status:` from `in-progress` to `done` also `git mv`s the file from `issues/` to `issues/archive/`.
2. Body references inside the archived file are left as-is (they still resolve since both source and target are in the repo).
3. Future open issues that `depends_on` an archived ID still resolve cleanly — the `roadmap.md` picker prompt reads both `issues/*.md` and `issues/archive/*.md`.

## Querying

```bash
rg "^status: done" issues/archive/*.md     # everything shipped
ls issues/archive/13.*.md                  # everything shipped from phase 13
git log --follow issues/archive/09.1-...md # full history of one issue
```

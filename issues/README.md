# Issues

This directory holds **execution items** — one file per Pull Request, scoped tightly enough that a single PR closes the file. Each issue is the source of truth for its own work; if you ever mirror these to GitHub Issues, the GitHub body should just point back to the file here.

## Why this lives in the repo

- **AI agents read files, not GitHub.** A coding agent can `glob issues/*.md`, find the next `status: open` item, read the linked design doc, and execute. No MCP setup required, no API tokens, no fuzzy navigation.
- **Single source of truth.** The file in `issues/` is canonical. Frontmatter holds the lifecycle state. PRs update the frontmatter when they ship.
- **Git-tracked lifecycle.** `git log issues/13.3-migrate-markets-router.md` shows when the work was scoped, started, and closed. No external dashboard needed.

## File naming

`<phase>.<sequence>-<short-kebab-slug>.md`

- **phase** — matches the corresponding `features/<NN>-...md` design doc.
- **sequence** — order within the phase. Run sequentially unless the design doc explicitly says otherwise.
- **slug** — a short verb-phrase summary. Keep under ~50 characters.

Examples:

- `12.1-sentry-account-setup.md`
- `13.3-migrate-markets-router.md`
- `13.9-gap-b3-admin-resolve-route-move.md`

## File structure

Every issue file starts with YAML frontmatter, then the Markdown body:

```markdown
---
id: 13.3
phase: backend-hardening
status: open          # open | in-progress | done | cancelled
pr: null              # filled with PR number/URL when one opens, e.g. "#42"
design_doc: features/13-backend-hardening.md
spec: project-specs/AUTHZ_MATRIX.md
depends_on: [13.1]    # other issue IDs this depends on; empty list if none
parallel_with: [13.4, 13.5]   # issues that can run concurrently
---

# 13.3 — Migrate `markets.py` exceptions to `AppError`

## Scope
[1–2 paragraphs. What changes and what doesn't.]

## Acceptance criteria
- [ ] Specific, verifiable bullet
- [ ] ...

## Spec / design references
- features/13-backend-hardening.md §2d, §3
- project-specs/AUTHZ_MATRIX.md §7b

## Verification
[Commands or manual steps to verify "done".]

## Notes
[Optional. Gotchas, related work, links.]
```

## Lifecycle

A normal flow:

1. **Created** with `status: open`. Some work needed before anyone picks it up (design pending, prerequisite not done).
2. **Picked up.** Set `status: in-progress`. Push the same commit that opens the PR; set `pr` to the PR number/URL.
3. **PR merges.** Set `status: done`. Leave the file in place — `git log` is the audit trail. Don't delete or move done files; the file history is part of the record.
4. **Cancelled.** Set `status: cancelled` if scope is dropped. Add a one-line note in the body explaining why.

Status transitions should happen in the same commit as the work itself, never standalone.

## Querying

Common one-liners (from repo root):

```bash
# All open issues
rg "^status: open" issues/ --multiline

# All issues for a phase
ls issues/13.*.md

# Find the next dependency-free open issue
rg -l "^status: open" issues/ | xargs rg -L "^depends_on: \[\]"
```

For an agent: `rg "^status: open" issues/` returns the queue. Read the first match, follow `design_doc` and `spec` references, do the work, update the frontmatter when shipping.

## Mirroring to GitHub Issues (optional)

If the team also wants a GitHub project board, mirror each open file with a one-line GitHub issue body:

```
See [`issues/13.3-migrate-markets-router.md`](../blob/main/issues/13.3-migrate-markets-router.md).

This file in the repo is the source of truth for scope and acceptance criteria.
Closes when the file's `status:` flips to `done`.
```

PRs use `Closes #N` for the GitHub auto-close. The file in `issues/` stays the canonical spec.

If the team is agent-only and doesn't need a board, skip GitHub Issues entirely. Both modes are supported.

## Relationship to `features/` and `project-specs/`

| Directory | Lifespan | Shape | Purpose |
|---|---|---|---|
| `project-specs/` | Long-lived | Reference; can be 300+ lines | Specs (AUTHZ_MATRIX, DATA_MODEL). Updated as the system evolves. |
| `features/` | Long-lived | Design rationale; ~200–400 lines | "Why we chose this shape." Cited by issues. Rarely updated post-approval. |
| `issues/` | Per-PR | Execution scope; ~50–150 lines | "What to do this week." Closed when shipped. |

If a piece of information is **why we chose this**, it goes in `features/`. If it's **what to do for one PR**, it goes in `issues/`. If it's **the contract everyone must respect**, it goes in `project-specs/`.

## Conventions

- **One issue, one PR.** If a piece of work needs two PRs, split it into two issue files.
- **Acceptance criteria are verifiable.** "Code is clean" is not acceptance; "`rg \"raise HTTPException\" backend/routers/` returns zero matches" is.
- **Negative-test verification.** If a check expects a query to *fail* (RLS denial, constraint violation, permission error), say so explicitly in the "Verification" section. Note that Supabase Studio surfaces expected errors as "Failed to run sql query" — the error firing IS the pass.
- **Reference, don't restate.** If a design choice is in the design doc, link to it (`§2d`). Don't paste the rationale into the issue.
- **Keep issues short.** A reader should be able to grok the scope in under 60 seconds. If you can't, the issue is too big — split it.
- **No CI hookup expected here.** Treat issue files as plain Markdown. Lint enforcement (e.g., "every PR updates an issue file") can be added later if useful, but isn't required for day-one usefulness.

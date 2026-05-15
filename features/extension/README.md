# features/extension/

Post-course design docs. The active design layer for ongoing work — each doc here is cited by a set of execution items in `../../issues/`.

## What's here

| File | Status | Drives |
|---|---|---|
| `11-redis-websockets.md` | **Dormant** — lives on a dedicated branch (`feature/redis-websockets`), not `main`. Activate when real-time updates become user-visible-necessary. | No open issues; activated by branching off the branch when needed. |
| `12-observability.md` | Active design | `../../issues/12.*.md` |
| `13-backend-hardening.md` | Active design | `../../issues/13.*.md` |
| `14-api-contract-tests.md` | Active design | `../../issues/14.*.md` |
| `15-playwright-ui-tests.md` | Active design | `../../issues/15.*.md` |
| `16-home-vs-markets-split.md` | Active design | `../../issues/16.*.md` |
| `17-market-creation-validation.md` | Active design | `../../issues/17.*.md` |
| `18-dummy-data-removal.md` | **Shipped.** Both execution issues (18.1, 18.2) have merged; see `../../issues/archive/`. | — |

## Conventions

- One doc per feature area, numbered sequentially.
- Doc style follows the established shape: a `Depends on:` / `Parallelizable with:` header, scope, design rationale, and an interaction-with-other-docs table at the bottom.
- Cross-references to siblings use the full path (`features/extension/13-...md`) so they resolve from any reader's context.
- When a feature ships, **leave the doc in place** but consider adding a short "Status: shipped" banner at the top (mirroring what was done for the course docs). The doc itself doesn't move — only the execution issues in `../../issues/` get archived.

## When to add a new file

- New design doc → next free number after 18.
- Don't put execution detail here — that's `../../issues/<id>-...md`.
- Don't put contract specs here — that's `../../project-specs/`.

See `../../issues/README.md` for the execution lifecycle and `../../issues/roadmap.md` for the current dependency wave plan.

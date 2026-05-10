# Feature 18: Dummy Data Removal — Inventory + Cleanup of Hardcoded Non-Persisted Values

**Status:** Design ratified
**Phase:** Hygiene
**Depends on:** None (purely a cleanup pass; doesn't depend on doc 12/13/14/15)
**Parallelizable with:** every other 12–17 doc
**Reads from:** `project-specs/AUTHZ_MATRIX.md` (any seeded user/market that pretends to be a real role must respect the matrix or be deleted)
**Branch:** `feature/dummy-data-removal` → 2 sub-PRs (see `issues/18.*.md`)
**Execution items:** `issues/18.1-dummy-data-inventory.md`, `issues/18.2-dummy-data-cleanup.md`

---

## Summary

The repository has accumulated some pieces of test/demo data hardcoded directly into source files rather than persisted through the normal UI flows. Some of it is legitimate runtime config (categories, time-zone options); some of it is dead test scaffolding that should be removed. **Without an inventory, it's hard to tell which is which.**

This feature does two PRs:

1. **18.1 — Inventory.** A mostly-read pass that produces a checklist of every candidate hardcoded-data site, classifies each as *config* (keep), *seed-script-only* (move to `seeds/`), *demo scaffolding* (remove), or *dead code* (remove).
2. **18.2 — Cleanup.** Acts on the inventory: removes / persists / relocates each item per the classification.

Splitting inventory from cleanup keeps the diff for cleanup small and trustworthy.

---

## What "dummy data" means here

The user's request: "remove any random dummy code that is hardcoded into this repo (rather than persisted normally through the UI)."

Concrete categories:

| Category | Examples | Action |
|---|---|---|
| **Runtime config** (legitimate) | `CATEGORIES = [...]` constants, `TIME_ZONE_OPTIONS = [...]` | **Keep** — this is config, not data. May relocate to a single `frontend/src/lib/constants.ts` for discoverability. |
| **Seed scripts** | `seed-plan.md`, any `.sql` or `.ts` script that inserts initial markets/users into a fresh DB | **Keep but isolate** — move out of source root into `seeds/` directory if not already there. Mark the directory clearly. |
| **Demo scaffolding** | `DEMO_USER_ID = "00000000-..."` sentinel, `setIsDemo(true)` paths, sample market data inlined in components | **Remove** if no longer needed for the product flow; **keep + document** if intentional. |
| **Dead code** | Commented-out code, unused exports referencing data that no longer exists, `// TODO: delete` markers older than 30 days | **Remove**. |
| **Dummy/placeholder content for empty states** | `"Markets will appear here once you create some."` | **Keep** — UX copy. |

The job is the classification, not pre-judging which category each finding belongs to.

---

## Initial Inventory (starting point — PR 18.1 will refine)

A quick pre-scan turned up these candidates. PR 18.1 will produce the authoritative list.

### Likely "runtime config" (keep)

- `frontend/src/app/admin/review/page.tsx:18` — `CATEGORIES = [...]`
- `frontend/src/app/markets/create/page.tsx:11` — `CATEGORIES = [...]` (duplicate of above — consolidate into `frontend/src/lib/constants.ts`)
- `frontend/src/app/markets/create/page.tsx:30` — `TIME_ZONE_OPTIONS = [...]`
- `frontend/src/components/probability-chart.tsx:17` — `OPTION_COLORS = [...]`
- Various `MAX_MARKET_*_LENGTH` constants in frontend files (also being touched by doc 17 — coordinate)

### Likely "demo scaffolding" (decide: keep documented, or remove)

- `frontend/src/lib/SessionProvider.tsx` — `isDemo` state, `setIsDemo(true)` when no session. The matrix §2 acknowledges `demo` as a frontend illusion (not a real backend role). **Decision:** keep, but ensure no path through demo writes data to the backend (it can't — backend sees demo as `anon` — but document this explicitly in a comment).
- `frontend/src/lib/types.ts` — likely `DEMO_USER_ID` sentinel (`00000000-...`). Same decision as above.
- `frontend/src/components/daily-claim-banner.tsx` — any demo-mode special case.
- `frontend/src/app/markets/[id]/detail-client.tsx` — any demo-mode messaging.

### Likely "seed scripts" (relocate / mark)

- `seed-plan.md` at repo root — a planning markdown describing a one-time seed. Could move to `seeds/PLAN.md` or `backend/supabase/seeds/` to make its scope obvious.
- Any `.sql` files or seed scripts in `backend/supabase/` related to demo data.

### Likely "dead code" (remove)

- Commented-out code blocks in any file (search via `rg "^\s*//[^/].*\b(TODO|FIXME|XXX)\b" frontend/src` and `rg "^\s*#.*\b(TODO|FIXME|XXX)\b" backend`).
- Any unused exports flagged by `eslint --rule "no-unused-vars": "error"` or equivalent — though this is not the inventory's job to fix; only to flag.

### Documents that reference the project schedule (light touch — out of scope for normal cleanup, see Notes)

- `project-specs/PROJECT_SPECS.md` and `project-specs/PRODUCT_BACKLOG.md` reference Sprint dates and "course staff." Per the team's earlier direction, these are **not** in scope for 18 — they're historical docs that can be left alone. If 18.1 surfaces something more critical here, escalate as a separate doc.

---

## Methodology (PR 18.1)

The inventory PR is mostly a `rg` sweep, classification, and a summary writeup. Suggested approach:

1. **Sweep these patterns** across `frontend/src/`, `backend/`, and `project-specs/`:
   - `rg "DEMO_USER_ID|isDemo|demo_user|sample[_A-Z]?[Dd]ata|MOCK|mock[_A-Z]?[Dd]ata|hardcod"`
   - `rg "^\s*(//|#)\s*(TODO|FIXME|XXX|HACK)"`
   - `rg "0000(-0000)+"` (UUID sentinels)
   - `rg -l "^const [A-Z_]+ = \[.*\]" frontend/src` (top-level constant arrays)
2. **For each match**, decide which of the four categories it belongs to. Record in the inventory output (a markdown table).
3. **Don't change anything in this PR** — outputs only the inventory + the cleanup plan.

The cleanup PR (18.2) takes the inventory as input and executes the recommended action per row.

---

## Files Affected

### 18.1 (inventory) — pure additions

| Area | File | Status |
|---|---|---|
| Docs | `issues/18.1-dummy-data-inventory.md` | Acceptance criteria includes the inventory output (added inline or as a separate `inventory.md` linked from the issue). |

### 18.2 (cleanup) — varies by inventory output, but typical

| Area | File | Status |
|---|---|---|
| Frontend | `frontend/src/lib/constants.ts` (new) | Consolidated `CATEGORIES`, `TIME_ZONE_OPTIONS`, etc. |
| Frontend | `frontend/src/app/admin/review/page.tsx`, `frontend/src/app/markets/create/page.tsx` | MODIFY — import from `lib/constants` instead of inline. |
| Frontend | `frontend/src/lib/SessionProvider.tsx`, `frontend/src/lib/types.ts` | MODIFY — add a comment block explaining the demo sentinel + reference to matrix §2. |
| Repo root | `seed-plan.md` | MOVE (or KEEP, depending on inventory decision). |
| Various | Files with dead commented-out code | MODIFY — delete. |

The 18.2 PR diff is sized by what 18.1 finds. If the inventory turns up a lot, split 18.2 into 18.2a / 18.2b by file group.

---

## Execution

| Issue | Title | Depends on |
|---|---|---|
| `issues/18.1-dummy-data-inventory.md` | Sweep + classify; produce inventory output. No code changes. | — |
| `issues/18.2-dummy-data-cleanup.md` | Execute the inventory's recommendations. | 18.1 |

If the inventory is large enough that 18.2 doesn't fit in a single review, split it during 18.1's writeup.

---

## Cross-References

| Doc | Relationship |
|---|---|
| `project-specs/AUTHZ_MATRIX.md` | §2 acknowledges `demo` as a frontend illusion. Any demo scaffolding kept after this doc must respect that — never write to the backend, never claim a real role. |
| `features/17-market-creation-validation.md` | If 17 touches the `MAX_MARKET_*` constants in `frontend/src/app/markets/create/page.tsx`, coordinate with 18.2 to avoid merge conflict (do 17 first or do them in the same PR). |
| `features/13-backend-hardening.md` | If the inventory finds any "dummy" route or test endpoint left in `backend/routers/`, 18.2 deletes it (consistent with 13's general "no dead code" cleanup). |

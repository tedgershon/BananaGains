# features/course/

> **Status: shipped.** Every feature doc in this directory (01–10) describes work that landed during the 17-437 course project. These files are preserved as a historical record of the original design and the orchestrator workflow that produced it. **They may not reflect current behavior** — the canonical product behavior lives in `project-specs/`.

## What's here

| File | Feature |
|---|---|
| `01-admin-system.md` | Admin & super-admin roles, RBAC, admin pages |
| `02-market-creation-review.md` | Market creation + admin review workflow |
| `03-multichoice-markets.md` | Non-binary markets (2–10 options) |
| `04-market-resolution.md` | Auto-resolution + community voting |
| `05-coin-claiming.md` | Daily claim with 5000-coin cap |
| `06-user-profile.md` | Avatar dropdown menu |
| `07-notifications.md` | In-app + email (Resend) notifications |
| `08-main-page.md` | Curated homepage (hottest, trending, leaderboard) |
| `09-claimable-rewards.md` | Badges + reward tracks |
| `10-safety-logic.md` | Bet hardening + admin backroll |
| `instructions.md` | The phased plan that orchestrated the 01–10 build |
| `LLM-instructions.md` | LLM-orchestrator variant of the same plan |
| `*.png` | Reference images cited by `instructions.md` |

## Why this is frozen

The course-era workflow was **one PR per feature**, human-in-the-loop, with the orchestrator docs as the central plan. That workflow has been retired in favor of the smaller-grained `issues/`-driven flow (see `../../issues/README.md`).

**Do not start new work from these files.** If a course feature needs revision:

1. Check `project-specs/` — that's the canonical contract.
2. If a behavior genuinely needs to change, write a new design doc in `features/extension/` that supersedes the relevant section of the course doc, then open an issue in `issues/`.

## Why we kept them

- Decision archaeology: "Why does multichoice work this way?" → `03-multichoice-markets.md`.
- Course retrospectives / portfolio / resume material.
- Onboarding context for anyone reading the codebase later.

Git history is the audit trail; these files are the design rationale that history points back to.

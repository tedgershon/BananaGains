# AGENTS.md

Navigation map. The authoritative spec for any task is the document this file points you to, not this file.

| You want to… | Start here |
|---|---|
| Implement a queued unit of work | `issues/README.md` → `issues/roadmap.md` → `issues/agent-prompt-template.md` (the kickoff prompt is the source of truth for execution) |
| Understand design rationale | `features/extension/` (active) — **not** `features/course/` (frozen; describes already-shipped 17-437 work and may not reflect current behavior) |
| Know what the system *must* do | `project-specs/` (AUTHZ_MATRIX, DATA_MODEL, MIGRATIONS, PROJECT_SPECS) |
| Run the app locally / contribute | top-level `README.md` |

One non-obvious rule: never start new implementation work from `features/course/*.md`. If a course-era behavior needs to change, write a new doc in `features/extension/` that supersedes it and open an issue in `issues/`.

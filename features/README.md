# features/

Design docs — the long-lived "**why** we chose this shape" record. One file per feature. Cited by issues and specs; rarely updated after the design is approved.

Split into two tiers by lifecycle:

| Subdir | What lives here | Workflow that produced / will produce it |
|---|---|---|
| `course/` | Features built during 17-437 (the original 01–10) plus the orchestrator docs (`instructions.md`, `LLM-instructions.md`) and reference images used to drive them. **All shipped.** Preserved as a historical record of the course build. | One-PR-per-feature, human-in-the-loop orchestrator, frequent commits. See `course/instructions.md`. |
| `extension/` | Post-course design docs (11–18). Mix of *active* (driving open issues in `issues/`) and *dormant* (`11-redis-websockets.md` sits on a dedicated branch until the user base demands real-time). | Per-PR issue files in `issues/`. See `../issues/README.md` and `../issues/roadmap.md`. |

## When to add a new feature doc

- New design doc → put it in `extension/`. Use the next free number after 18.
- `course/` is **frozen**. Don't add new files here; if a course feature needs revision, write an `extension/`-style design doc that supersedes it and update `project-specs/` accordingly.

## What `features/` is *not*

- Not a status board — that's `issues/`.
- Not the contract everyone must respect — that's `project-specs/` (e.g., `AUTHZ_MATRIX.md`, `DATA_MODEL.md`).
- Not an implementation log — git history is the log.

See `../AGENTS.md` for the agent-facing entry point and `../issues/README.md` for the full execution lifecycle.

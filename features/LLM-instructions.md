You are the implementation orchestrator for BananaGains, a prediction market
web app. Your job is to implement 10 new features by delegating each one to a
subagent, respecting dependency ordering, and verifying each feature before
moving to the next phase.

## STEP 1 — Read the plan

Read `features/instructions.md`. This contains the phased implementation plan,
dependency graph, migration numbering, and a quick-reference table of affected
files. Internalize the four phases and which features can be parallelized.

## STEP 2 — Implement phase by phase

Work through Phases 1–4 in strict order. Within each phase, launch parallelizable
features as concurrent subagents. For each feature:

1. Read the feature file (e.g. `features/01-admin-system.md`) in its entirety.
   It contains the complete specification: database migrations, backend endpoints,
   frontend components, and a testing checklist.

2. Hand the subagent ALL of the following context:
   - The full contents of the feature file
   - The relevant existing source files listed in the "Files Affected" section
     of instructions.md (have the subagent read them before writing any code)
   - The current migration numbering (latest .sql file in backend/supabase/migrations/)
   - This constraint: "Match existing code style exactly. Do not modify files
     outside your feature scope. Run linting after changes."

3. The subagent should:
   a. Write the SQL migration files (if any) to backend/supabase/migrations/
   b. Implement backend changes (Python/FastAPI)
   c. Implement frontend changes (TypeScript/Next.js)
   d. Verify there are no linter errors
   e. Walk through every item in the Testing Checklist at the bottom of the
      feature file and confirm the implementation satisfies each one

4. When a subagent finishes, review its output:
   - Confirm all files listed in the feature spec were created or modified
   - Confirm migration numbers match the reserved range in instructions.md
   - Check for any cross-feature conflicts (especially shared files like
     navbar.tsx, main.py, types.ts, api.ts)

## STEP 3 — Phase gate

Before starting the next phase:
- Verify all features in the current phase are complete
- Resolve any conflicts in shared files (navbar.tsx, main.py, lib/types.ts,
  lib/api.ts are touched by multiple features)
- Ensure all new backend routers are registered in main.py
- Ensure all new nav links are added to the navbar

## STEP 4 — Final integration

After all four phases:
- Read project-specs/MIGRATIONS.md and verify all implemented migrations match
- Run the frontend build (cd frontend && pnpm build) — fix any type errors
- Run the backend linter — fix any issues
- Update project-specs/ docs if any implementation deviated from the plan

## Key constraints

- The tech stack is: FastAPI + Supabase (Python backend), Next.js App Router +
  shadcn/ui + Tailwind (TypeScript frontend), PostgreSQL via Supabase
- SQL migrations are NOT applied automatically. Write them as .sql files in
  backend/supabase/migrations/ — the user runs them manually in Supabase
- Do not install new dependencies without justification. The existing deps
  (recharts, lucide-react, shadcn, etc.) cover most needs.
- Shared files that multiple features touch: components/navbar.tsx, lib/types.ts,
  lib/api.ts, backend/main.py, backend/dependencies.py. When merging parallel
  subagent outputs, manually reconcile these files.
- Never commit secrets or .env files.
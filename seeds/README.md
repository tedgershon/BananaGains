# seeds/

Documentation-only seed material for the project database.

- `PLAN.md` — the v2 seed plan: Silicon Valley user fixtures plus the
  CMU markets used to populate a fresh Supabase instance for demos
  and screenshots. Contains the SQL transaction inline.

Nothing in this directory is auto-applied. Migrations under
`backend/supabase/migrations/` are still the source of truth for
schema changes; this directory exists so seed scripts and plans
don't sit in the repo root.

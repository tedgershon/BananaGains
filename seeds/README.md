# seeds/

Documentation-only seed material for the project database.

- `PLAN.md` — the v2 seed plan: Silicon Valley user fixtures plus the
  CMU markets used to populate a fresh Supabase instance for demos
  and screenshots. Contains the SQL transaction inline.
- `TEARDOWN.sql` — companion to `PLAN.md` that removes the 8 fixture
  users and every market, bet, vote, dispute, and ledger entry tied
  to them. Scoped strictly by Andrew ID so real OAuth signups are
  never touched. Run via Supabase Studio (service-role) when the
  fixture data needs to be purged.

Nothing in this directory is auto-applied. Migrations under
`backend/supabase/migrations/` are still the source of truth for
schema changes; this directory exists so seed scripts and plans
don't sit in the repo root.

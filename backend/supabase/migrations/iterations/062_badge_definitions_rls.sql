-- Enable Row Level Security on badge_definitions and add a public SELECT
-- policy. Closes the Supabase linter finding that flags the table as public
-- but RLS-disabled. Mirrors the pattern used for user_badges in 045: catalog
-- rows are world-readable; mutations remain service-role-only (which bypasses
-- RLS) — matches how the seed data is loaded in 044_badge_definitions.sql.

ALTER TABLE badge_definitions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'badge_definitions'
          AND policyname = 'Badge definitions are viewable by everyone'
    ) THEN
        CREATE POLICY "Badge definitions are viewable by everyone"
            ON badge_definitions FOR SELECT
            TO public
            USING (true);
    END IF;
END $$;

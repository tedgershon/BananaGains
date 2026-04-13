-- PostgREST uses roles `anon` and `authenticated`. A policy "TO public" can still
-- fail to match in some setups; be explicit so backend + browser API inserts work.

DROP POLICY IF EXISTS "System can insert notifications" ON notifications;

CREATE POLICY "System can insert notifications"
    ON notifications FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- Fix notifications RLS to allow backend service inserts
-- The current policy WITH CHECK (true) should work, but we need to ensure
-- it applies to both authenticated and anon roles

DROP POLICY IF EXISTS "System can insert notifications" ON notifications;

-- Allow inserts from any role (backend uses anon key)
CREATE POLICY "System can insert notifications"
    ON notifications FOR INSERT
    TO public
    WITH CHECK (true);

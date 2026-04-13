-- Strict notifications hardening:
-- 1) No direct client inserts
-- 2) No general updates
-- 3) Allow only mark-as-read (is_read=true) on own rows

DROP POLICY IF EXISTS "System can insert notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;

-- Restrict UPDATE privilege to the is_read column for authenticated users.
REVOKE UPDATE ON TABLE notifications FROM authenticated;
GRANT UPDATE (is_read) ON TABLE notifications TO authenticated;

CREATE POLICY "Users can mark own notifications read"
    ON notifications FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id AND is_read = TRUE);

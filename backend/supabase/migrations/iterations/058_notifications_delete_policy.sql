-- Allow users to delete their own in-app notifications (API uses authenticated JWT).
CREATE POLICY "Users can delete own notifications"
    ON notifications FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

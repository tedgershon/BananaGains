CREATE OR REPLACE FUNCTION get_unread_notification_count(
    p_user_id UUID
) RETURNS INTEGER AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)::INTEGER
        FROM notifications
        WHERE user_id = p_user_id AND is_read = FALSE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

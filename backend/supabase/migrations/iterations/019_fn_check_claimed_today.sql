-- 019: function — check if user has claimed daily bananas today

CREATE OR REPLACE FUNCTION check_claimed_today(
    p_user_id UUID
) RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM transactions
        WHERE user_id = p_user_id
          AND transaction_type = 'daily_claim'
          AND (created_at AT TIME ZONE 'America/New_York')::date = (now() AT TIME ZONE 'America/New_York')::date
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

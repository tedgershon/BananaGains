-- 018: function — claim 1000 bananas once per calendar day (America/New_York)

CREATE OR REPLACE FUNCTION claim_daily_bananas(
    p_user_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_today   DATE;
    v_balance NUMERIC;
BEGIN
    v_today := (now() AT TIME ZONE 'America/New_York')::date;

    SELECT banana_balance INTO v_balance FROM profiles WHERE id = p_user_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User not found';
    END IF;

    IF EXISTS (
        SELECT 1 FROM transactions
        WHERE user_id = p_user_id
          AND transaction_type = 'daily_claim'
          AND (created_at AT TIME ZONE 'America/New_York')::date = v_today
    ) THEN
        RAISE EXCEPTION 'Already claimed today';
    END IF;

    UPDATE profiles SET banana_balance = banana_balance + 1000 WHERE id = p_user_id;

    INSERT INTO transactions (user_id, transaction_type, amount)
    VALUES (p_user_id, 'daily_claim', 1000);

    RETURN jsonb_build_object(
        'new_balance', v_balance + 1000,
        'claimed_at', now()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

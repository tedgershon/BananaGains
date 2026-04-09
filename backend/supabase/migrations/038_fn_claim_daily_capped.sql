-- 038: Replace the claim function with a capped version (5000 balance cap)

CREATE OR REPLACE FUNCTION claim_daily_bananas(
    p_user_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_today   DATE;
    v_balance NUMERIC;
    v_claim_amount NUMERIC;
    v_cap NUMERIC := 5000;
BEGIN
    v_today := (now() AT TIME ZONE 'America/New_York')::date;

    SELECT banana_balance INTO v_balance FROM profiles WHERE id = p_user_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User not found';
    END IF;

    -- Check if already claimed today
    IF EXISTS (
        SELECT 1 FROM transactions
        WHERE user_id = p_user_id
          AND transaction_type = 'daily_claim'
          AND (created_at AT TIME ZONE 'America/New_York')::date = v_today
    ) THEN
        RAISE EXCEPTION 'Already claimed today';
    END IF;

    -- Check balance cap (based on coin balance, not active bets)
    IF v_balance >= v_cap THEN
        RAISE EXCEPTION 'Balance is at or above the daily claim cap of 5000';
    END IF;

    -- Calculate claim amount: min(1000, cap - balance)
    v_claim_amount := LEAST(1000, v_cap - v_balance);

    IF v_claim_amount <= 0 THEN
        RAISE EXCEPTION 'Balance is at or above the daily claim cap of 5000';
    END IF;

    UPDATE profiles SET banana_balance = banana_balance + v_claim_amount WHERE id = p_user_id;

    INSERT INTO transactions (user_id, transaction_type, amount)
    VALUES (p_user_id, 'daily_claim', v_claim_amount);

    RETURN jsonb_build_object(
        'new_balance', v_balance + v_claim_amount,
        'claimed_amount', v_claim_amount,
        'claimed_at', now()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 039: Returns claim eligibility info for the UI

CREATE OR REPLACE FUNCTION check_claim_eligibility(
    p_user_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_today DATE;
    v_balance NUMERIC;
    v_claimed_today BOOLEAN;
    v_eligible BOOLEAN;
    v_claim_amount NUMERIC;
    v_cap NUMERIC := 5000;
BEGIN
    v_today := (now() AT TIME ZONE 'America/New_York')::date;

    SELECT banana_balance INTO v_balance FROM profiles WHERE id = p_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User not found';
    END IF;

    v_claimed_today := EXISTS (
        SELECT 1 FROM transactions
        WHERE user_id = p_user_id
          AND transaction_type = 'daily_claim'
          AND (created_at AT TIME ZONE 'America/New_York')::date = v_today
    );

    v_eligible := NOT v_claimed_today AND v_balance < v_cap;
    v_claim_amount := CASE
        WHEN NOT v_eligible THEN 0
        ELSE LEAST(1000, v_cap - v_balance)
    END;

    RETURN jsonb_build_object(
        'eligible', v_eligible,
        'claimed_today', v_claimed_today,
        'balance', v_balance,
        'claim_amount', v_claim_amount,
        'cap', v_cap,
        'above_cap', v_balance >= v_cap
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

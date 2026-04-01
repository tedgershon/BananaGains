-- 014: function — shared payout logic called by all 3 resolution paths

CREATE OR REPLACE FUNCTION finalize_resolution(
    p_market_id UUID,
    p_outcome   TEXT
) RETURNS JSONB AS $$
DECLARE
    v_status       TEXT;
    v_yes_pool     NUMERIC;
    v_no_pool      NUMERIC;
    v_total_pool   NUMERIC;
    v_winning_pool NUMERIC;
    v_bet          RECORD;
    v_payout       NUMERIC;
BEGIN
    IF p_outcome NOT IN ('YES', 'NO') THEN
        RAISE EXCEPTION 'Invalid outcome: must be YES or NO';
    END IF;

    SELECT status, yes_pool_total, no_pool_total
    INTO v_status, v_yes_pool, v_no_pool
    FROM markets WHERE id = p_market_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Market not found';
    END IF;

    IF v_status NOT IN ('pending_resolution', 'disputed', 'admin_review') THEN
        RAISE EXCEPTION 'Market cannot be finalized from status: %', v_status;
    END IF;

    UPDATE markets SET
        status           = 'resolved',
        resolved_outcome = p_outcome,
        resolved_at      = now()
    WHERE id = p_market_id;

    v_total_pool := v_yes_pool + v_no_pool;

    IF p_outcome = 'YES' THEN
        v_winning_pool := v_yes_pool;
    ELSE
        v_winning_pool := v_no_pool;
    END IF;

    -- no one bet on winning side: refund everyone
    IF v_winning_pool = 0 THEN
        FOR v_bet IN
            SELECT user_id, amount FROM bets WHERE market_id = p_market_id
        LOOP
            UPDATE profiles SET banana_balance = banana_balance + v_bet.amount
            WHERE id = v_bet.user_id;

            INSERT INTO transactions (user_id, market_id, transaction_type, amount)
            VALUES (v_bet.user_id, p_market_id, 'payout', v_bet.amount);
        END LOOP;
    ELSE
        -- proportional payout to winners
        FOR v_bet IN
            SELECT user_id, SUM(amount) AS user_total
            FROM bets WHERE market_id = p_market_id AND side = p_outcome
            GROUP BY user_id
        LOOP
            v_payout := TRUNC(v_bet.user_total * (v_total_pool / v_winning_pool), 2);

            UPDATE profiles SET banana_balance = banana_balance + v_payout
            WHERE id = v_bet.user_id;

            INSERT INTO transactions (user_id, market_id, transaction_type, amount)
            VALUES (v_bet.user_id, p_market_id, 'payout', v_payout);
        END LOOP;
    END IF;

    RETURN jsonb_build_object(
        'market_id', p_market_id,
        'status', 'resolved',
        'outcome', p_outcome
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

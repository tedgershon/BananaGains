-- Resolve a multichoice market
-- p_winning_option_ids: array of option UUIDs that are winners
-- For exclusive: exactly one winner
-- For non_exclusive: one or more winners
CREATE OR REPLACE FUNCTION resolve_multichoice_market(
    p_market_id UUID,
    p_winning_option_ids UUID[]
) RETURNS JSONB AS $$
DECLARE
    v_market_type TEXT;
    v_multichoice_type TEXT;
    v_status TEXT;
    v_total_pool NUMERIC := 0;
    v_winning_pool NUMERIC := 0;
    v_opt RECORD;
    v_bet RECORD;
    v_payout NUMERIC;
BEGIN
    SELECT market_type, multichoice_type, status
    INTO v_market_type, v_multichoice_type, v_status
    FROM markets WHERE id = p_market_id FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Market not found'; END IF;
    IF v_market_type != 'multichoice' THEN RAISE EXCEPTION 'Not a multichoice market'; END IF;
    IF v_status NOT IN ('pending_resolution', 'disputed', 'admin_review', 'closed') THEN
        RAISE EXCEPTION 'Market cannot be resolved from status: %', v_status;
    END IF;

    IF v_multichoice_type = 'exclusive' AND array_length(p_winning_option_ids, 1) != 1 THEN
        RAISE EXCEPTION 'Exclusive markets must have exactly one winner';
    END IF;

    -- Mark winning and losing options
    UPDATE market_options SET is_winner = FALSE WHERE market_id = p_market_id;
    UPDATE market_options SET is_winner = TRUE WHERE id = ANY(p_winning_option_ids);

    -- Calculate total pool and winning pool
    SELECT COALESCE(SUM(pool_total), 0) INTO v_total_pool
    FROM market_options WHERE market_id = p_market_id;

    SELECT COALESCE(SUM(pool_total), 0) INTO v_winning_pool
    FROM market_options WHERE id = ANY(p_winning_option_ids);

    -- Update market status
    UPDATE markets SET
        status = 'resolved',
        resolved_at = now()
    WHERE id = p_market_id;

    -- Distribute payouts
    IF v_winning_pool = 0 THEN
        -- No one bet on winning options: refund everyone
        FOR v_bet IN
            SELECT user_id, amount FROM bets WHERE market_id = p_market_id
        LOOP
            UPDATE profiles SET banana_balance = banana_balance + v_bet.amount WHERE id = v_bet.user_id;
            INSERT INTO transactions (user_id, market_id, transaction_type, amount)
            VALUES (v_bet.user_id, p_market_id, 'payout', v_bet.amount);
        END LOOP;
    ELSE
        -- Proportional payout to winners
        FOR v_bet IN
            SELECT user_id, SUM(amount) AS user_total
            FROM bets
            WHERE market_id = p_market_id AND option_id = ANY(p_winning_option_ids)
            GROUP BY user_id
        LOOP
            v_payout := TRUNC(v_bet.user_total * (v_total_pool / v_winning_pool), 2);
            UPDATE profiles SET banana_balance = banana_balance + v_payout WHERE id = v_bet.user_id;
            INSERT INTO transactions (user_id, market_id, transaction_type, amount)
            VALUES (v_bet.user_id, p_market_id, 'payout', v_payout);
        END LOOP;
    END IF;

    RETURN jsonb_build_object(
        'market_id', p_market_id,
        'status', 'resolved',
        'winning_options', p_winning_option_ids
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

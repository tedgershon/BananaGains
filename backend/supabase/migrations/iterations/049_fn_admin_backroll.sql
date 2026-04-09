-- 049_fn_admin_backroll.sql
-- Admin backroll: cancel bets placed after a given cutoff date
-- and refund those bettors. Adjust pool totals accordingly.

CREATE OR REPLACE FUNCTION admin_backroll_market(
    p_market_id   UUID,
    p_admin_id    UUID,
    p_cutoff_date TIMESTAMPTZ,
    p_close_market BOOLEAN DEFAULT TRUE
) RETURNS JSONB AS $$
DECLARE
    v_is_admin BOOLEAN;
    v_status TEXT;
    v_bet RECORD;
    v_total_refunded NUMERIC := 0;
    v_bets_cancelled INTEGER := 0;
    v_yes_refund NUMERIC := 0;
    v_no_refund NUMERIC := 0;
BEGIN
    -- Verify admin
    SELECT (role IN ('admin', 'super_admin')) INTO v_is_admin
    FROM profiles WHERE id = p_admin_id;

    IF v_is_admin IS NOT TRUE THEN
        RAISE EXCEPTION 'Only admins can perform backroll';
    END IF;

    -- Lock market
    SELECT status INTO v_status FROM markets WHERE id = p_market_id FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Market not found'; END IF;

    IF v_status = 'resolved' THEN
        RAISE EXCEPTION 'Cannot backroll a resolved market. Resolve must happen after backroll.';
    END IF;

    -- Find and refund bets placed after the cutoff
    FOR v_bet IN
        SELECT id, user_id, side, amount
        FROM bets
        WHERE market_id = p_market_id
          AND created_at > p_cutoff_date
        ORDER BY created_at DESC
    LOOP
        -- Refund the user
        UPDATE profiles SET banana_balance = banana_balance + v_bet.amount
        WHERE id = v_bet.user_id;

        -- Record refund transaction
        INSERT INTO transactions (user_id, market_id, transaction_type, amount)
        VALUES (v_bet.user_id, p_market_id, 'payout', v_bet.amount);

        -- Track pool adjustments
        IF v_bet.side = 'YES' THEN
            v_yes_refund := v_yes_refund + v_bet.amount;
        ELSE
            v_no_refund := v_no_refund + v_bet.amount;
        END IF;

        v_total_refunded := v_total_refunded + v_bet.amount;
        v_bets_cancelled := v_bets_cancelled + 1;

        -- Delete the bet
        DELETE FROM bets WHERE id = v_bet.id;
    END LOOP;

    -- Adjust pool totals
    UPDATE markets SET
        yes_pool_total = GREATEST(0, yes_pool_total - v_yes_refund),
        no_pool_total = GREATEST(0, no_pool_total - v_no_refund)
    WHERE id = p_market_id;

    -- Optionally close the market with the cutoff as the true close time
    IF p_close_market THEN
        UPDATE markets SET
            status = 'closed',
            close_at = p_cutoff_date
        WHERE id = p_market_id;
    END IF;

    RETURN jsonb_build_object(
        'market_id', p_market_id,
        'bets_cancelled', v_bets_cancelled,
        'total_refunded', v_total_refunded,
        'new_close_at', p_cutoff_date,
        'status', CASE WHEN p_close_market THEN 'closed' ELSE v_status END
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

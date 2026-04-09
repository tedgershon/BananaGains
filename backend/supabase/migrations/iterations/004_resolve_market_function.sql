-- 004_resolve_market_function.sql
-- Function to resolve a market, calculate payouts, and distribute bananas to winners.
-- Also supports refunding perfectly balanced or single-sided markets by resolving as "CANCELLED" or distributing.

CREATE OR REPLACE FUNCTION resolve_market(
    p_market_id UUID,
    p_outcome   TEXT,
    p_resolver_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_market_status TEXT;
    v_yes_pool NUMERIC;
    v_no_pool NUMERIC;
    v_creator_id UUID;
    v_total_pool NUMERIC;
    v_winning_pool NUMERIC;
    
    -- Variables for looping through bets
    v_bet RECORD;
    v_payout NUMERIC;
BEGIN
    -- Validate outcome
    IF p_outcome NOT IN ('YES', 'NO') THEN
        RAISE EXCEPTION 'Invalid outcome: must be YES or NO';
    END IF;

    -- Lock the market row
    SELECT status, yes_pool_total, no_pool_total, creator_id 
    INTO v_market_status, v_yes_pool, v_no_pool, v_creator_id
    FROM markets
    WHERE id = p_market_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Market not found';
    END IF;

    IF v_market_status IN ('resolved', 'disputed') THEN
        RAISE EXCEPTION 'Market is already resolved or disputed';
    END IF;
    
    IF p_resolver_id != v_creator_id THEN
        RAISE EXCEPTION 'Only the market creator can resolve this market';
    END IF;
    
    v_total_pool := v_yes_pool + v_no_pool;
    
    IF p_outcome = 'YES' THEN
        v_winning_pool := v_yes_pool;
    ELSE
        v_winning_pool := v_no_pool;
    END IF;

    -- Update market status
    UPDATE markets
    SET status = 'resolved',
        resolved_outcome = p_outcome,
        resolved_at = now()
    WHERE id = p_market_id;
    
    -- Calculate and distribute payouts
    -- If no one bet on the winning side, or total pool is 0, we can either refund or just close.
    -- Here, let's refund everyone if the winning pool is 0 (so nobody won, or no bets at all).
    IF v_winning_pool = 0 THEN
        FOR v_bet IN 
            SELECT user_id, amount, side
            FROM bets
            WHERE market_id = p_market_id
        LOOP
            -- Refund the exact amount
            UPDATE profiles
            SET banana_balance = banana_balance + v_bet.amount
            WHERE id = v_bet.user_id;
            
            INSERT INTO transactions (user_id, market_id, transaction_type, amount)
            VALUES (v_bet.user_id, p_market_id, 'payout', v_bet.amount);
        END LOOP;
    ELSE
        -- Standard proportional payout
        -- We loop through all bets on the *winning* side
        -- They get their original bet + a proportional share of the losing pool
        FOR v_bet IN
            SELECT user_id, SUM(amount) as user_total
            FROM bets
            WHERE market_id = p_market_id AND side = p_outcome
            GROUP BY user_id
        LOOP
            -- user's fraction of the winning pool
            -- their payout = user_total + ( (user_total / winning_pool) * losing_pool )
            -- which mathematically simplifies to: user_total * (total_pool / winning_pool)
            v_payout := TRUNC(v_bet.user_total * (v_total_pool / v_winning_pool), 2);
            
            -- Add to their balance
            UPDATE profiles
            SET banana_balance = banana_balance + v_payout
            WHERE id = v_bet.user_id;

            -- Record the payout transaction
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

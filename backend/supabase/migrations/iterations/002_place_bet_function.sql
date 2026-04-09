-- 002_place_bet_function.sql
-- Atomic bet placement: validates balance & market status, then updates all
-- tables in a single transaction with row-level locking.

CREATE OR REPLACE FUNCTION place_bet(
    p_user_id   UUID,
    p_market_id UUID,
    p_side      TEXT,
    p_amount    NUMERIC
) RETURNS JSONB AS $$
DECLARE
    v_balance       NUMERIC;
    v_market_status TEXT;
    v_bet_id        UUID;
BEGIN
    -- Validate side
    IF p_side NOT IN ('YES', 'NO') THEN
        RAISE EXCEPTION 'Invalid side: must be YES or NO';
    END IF;

    -- Validate amount
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Bet amount must be positive';
    END IF;

    -- Lock the user row and check balance
    SELECT banana_balance INTO v_balance
    FROM profiles
    WHERE id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User not found';
    END IF;

    IF v_balance < p_amount THEN
        RAISE EXCEPTION 'Insufficient balance';
    END IF;

    -- Lock the market row and check status
    SELECT status INTO v_market_status
    FROM markets
    WHERE id = p_market_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Market not found';
    END IF;

    IF v_market_status != 'open' THEN
        RAISE EXCEPTION 'Market is not open for betting';
    END IF;

    -- Deduct from user balance
    UPDATE profiles
    SET banana_balance = banana_balance - p_amount
    WHERE id = p_user_id;

    -- Add to the appropriate pool
    IF p_side = 'YES' THEN
        UPDATE markets
        SET yes_pool_total = yes_pool_total + p_amount
        WHERE id = p_market_id;
    ELSE
        UPDATE markets
        SET no_pool_total = no_pool_total + p_amount
        WHERE id = p_market_id;
    END IF;

    -- Record the bet
    INSERT INTO bets (user_id, market_id, side, amount)
    VALUES (p_user_id, p_market_id, p_side, p_amount)
    RETURNING id INTO v_bet_id;

    -- Record the transaction
    INSERT INTO transactions (user_id, market_id, transaction_type, amount)
    VALUES (p_user_id, p_market_id, 'bet_placement', -p_amount);

    RETURN jsonb_build_object(
        'bet_id', v_bet_id,
        'new_balance', v_balance - p_amount
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

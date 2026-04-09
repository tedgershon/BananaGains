CREATE OR REPLACE FUNCTION place_multichoice_bet(
    p_user_id   UUID,
    p_market_id UUID,
    p_option_id UUID,
    p_amount    NUMERIC
) RETURNS JSONB AS $$
DECLARE
    v_balance       NUMERIC;
    v_market_status TEXT;
    v_market_type   TEXT;
    v_option_market UUID;
    v_bet_id        UUID;
BEGIN
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Bet amount must be positive';
    END IF;

    -- Verify option belongs to the market
    SELECT market_id INTO v_option_market
    FROM market_options WHERE id = p_option_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Option not found';
    END IF;

    IF v_option_market != p_market_id THEN
        RAISE EXCEPTION 'Option does not belong to this market';
    END IF;

    -- Lock user and check balance
    SELECT banana_balance INTO v_balance
    FROM profiles WHERE id = p_user_id FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'User not found'; END IF;
    IF v_balance < p_amount THEN RAISE EXCEPTION 'Insufficient balance'; END IF;

    -- Lock market and check status
    SELECT status, market_type INTO v_market_status, v_market_type
    FROM markets WHERE id = p_market_id FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Market not found'; END IF;
    IF v_market_status != 'open' THEN RAISE EXCEPTION 'Market is not open for betting'; END IF;
    IF v_market_type != 'multichoice' THEN RAISE EXCEPTION 'Market is not multichoice'; END IF;

    -- Deduct balance
    UPDATE profiles SET banana_balance = banana_balance - p_amount WHERE id = p_user_id;

    -- Update option pool
    UPDATE market_options SET pool_total = pool_total + p_amount WHERE id = p_option_id;

    -- Record the bet
    INSERT INTO bets (user_id, market_id, option_id, amount)
    VALUES (p_user_id, p_market_id, p_option_id, p_amount)
    RETURNING id INTO v_bet_id;

    -- Record transaction
    INSERT INTO transactions (user_id, market_id, transaction_type, amount)
    VALUES (p_user_id, p_market_id, 'bet_placement', -p_amount);

    RETURN jsonb_build_object(
        'bet_id', v_bet_id,
        'new_balance', v_balance - p_amount
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

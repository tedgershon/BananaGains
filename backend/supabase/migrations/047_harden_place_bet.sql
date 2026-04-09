-- 047_harden_place_bet.sql
-- Harden the place_bet function:
--   1. Check close_at timestamp (lazy close at bet time) in addition to status
--   2. Prevent market creators from betting on their own markets
-- Concurrency note: FOR UPDATE locks on both profiles and markets rows
-- ensure that concurrent bets by the same user or on the same market
-- are serialized. PostgreSQL guarantees no lost updates or dirty reads.

CREATE OR REPLACE FUNCTION place_bet(
    p_user_id   UUID,
    p_market_id UUID,
    p_side      TEXT,
    p_amount    NUMERIC
) RETURNS JSONB AS $$
DECLARE
    v_balance       NUMERIC;
    v_market_status TEXT;
    v_close_at      TIMESTAMPTZ;
    v_creator_id    UUID;
    v_bet_id        UUID;
BEGIN
    IF p_side NOT IN ('YES', 'NO') THEN
        RAISE EXCEPTION 'Invalid side: must be YES or NO';
    END IF;
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Bet amount must be positive';
    END IF;

    SELECT banana_balance INTO v_balance
    FROM profiles WHERE id = p_user_id FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'User not found'; END IF;
    IF v_balance < p_amount THEN RAISE EXCEPTION 'Insufficient balance'; END IF;

    SELECT status, close_at, creator_id INTO v_market_status, v_close_at, v_creator_id
    FROM markets WHERE id = p_market_id FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Market not found'; END IF;

    -- Creator cannot bet on their own market
    IF p_user_id = v_creator_id THEN
        RAISE EXCEPTION 'Market creators cannot place bets on their own markets';
    END IF;

    -- Check both status AND close_at timestamp
    IF v_market_status != 'open' THEN
        RAISE EXCEPTION 'Market is not open for betting';
    END IF;

    IF v_close_at <= now() THEN
        UPDATE markets SET status = 'closed' WHERE id = p_market_id;
        RAISE EXCEPTION 'Market has closed';
    END IF;

    UPDATE profiles SET banana_balance = banana_balance - p_amount WHERE id = p_user_id;

    IF p_side = 'YES' THEN
        UPDATE markets SET yes_pool_total = yes_pool_total + p_amount WHERE id = p_market_id;
    ELSE
        UPDATE markets SET no_pool_total = no_pool_total + p_amount WHERE id = p_market_id;
    END IF;

    INSERT INTO bets (user_id, market_id, side, amount)
    VALUES (p_user_id, p_market_id, p_side, p_amount)
    RETURNING id INTO v_bet_id;

    INSERT INTO transactions (user_id, market_id, transaction_type, amount)
    VALUES (p_user_id, p_market_id, 'bet_placement', -p_amount);

    RETURN jsonb_build_object(
        'bet_id', v_bet_id,
        'new_balance', v_balance - p_amount
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

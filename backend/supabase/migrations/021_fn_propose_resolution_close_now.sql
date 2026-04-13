-- 021: allow propose_resolution to auto-close markets once close_at has passed

CREATE OR REPLACE FUNCTION propose_resolution(
    p_market_id   UUID,
    p_outcome     TEXT,
    p_proposer_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_status     TEXT;
    v_creator_id UUID;
    v_close_at   TIMESTAMPTZ;
BEGIN
    IF p_outcome NOT IN ('YES', 'NO') THEN
        RAISE EXCEPTION 'Invalid outcome: must be YES or NO';
    END IF;

    SELECT status, creator_id, close_at INTO v_status, v_creator_id, v_close_at
    FROM markets WHERE id = p_market_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Market not found';
    END IF;

    IF v_status = 'open' AND v_close_at <= now() THEN
        UPDATE markets SET status = 'closed' WHERE id = p_market_id;
        v_status := 'closed';
    END IF;

    IF v_status != 'closed' THEN
        RAISE EXCEPTION 'Market must be closed before proposing resolution';
    END IF;

    IF p_proposer_id != v_creator_id THEN
        RAISE EXCEPTION 'Only the market creator can propose a resolution';
    END IF;

    UPDATE markets SET
        status            = 'pending_resolution',
        proposed_outcome  = p_outcome,
        proposed_at       = now(),
        dispute_deadline  = now() + interval '24 hours'
    WHERE id = p_market_id;

    RETURN jsonb_build_object(
        'market_id', p_market_id,
        'status', 'pending_resolution',
        'proposed_outcome', p_outcome,
        'dispute_deadline', now() + interval '24 hours'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

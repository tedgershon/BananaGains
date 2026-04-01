-- 013: function — creator proposes outcome, starts 24h dispute window

CREATE OR REPLACE FUNCTION propose_resolution(
    p_market_id   UUID,
    p_outcome     TEXT,
    p_proposer_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_status     TEXT;
    v_creator_id UUID;
BEGIN
    IF p_outcome NOT IN ('YES', 'NO') THEN
        RAISE EXCEPTION 'Invalid outcome: must be YES or NO';
    END IF;

    SELECT status, creator_id INTO v_status, v_creator_id
    FROM markets WHERE id = p_market_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Market not found';
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

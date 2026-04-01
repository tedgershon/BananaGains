-- 015: function — file a dispute during pending_resolution window

CREATE OR REPLACE FUNCTION file_dispute(
    p_market_id   UUID,
    p_disputer_id UUID,
    p_explanation TEXT
) RETURNS JSONB AS $$
DECLARE
    v_status           TEXT;
    v_dispute_deadline  TIMESTAMPTZ;
    v_dispute_id       UUID;
BEGIN
    SELECT status, dispute_deadline INTO v_status, v_dispute_deadline
    FROM markets WHERE id = p_market_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Market not found';
    END IF;

    IF v_status != 'pending_resolution' THEN
        RAISE EXCEPTION 'Market is not in pending_resolution status';
    END IF;

    IF now() >= v_dispute_deadline THEN
        RAISE EXCEPTION 'Dispute window has expired';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_disputer_id) THEN
        RAISE EXCEPTION 'User not found';
    END IF;

    INSERT INTO disputes (market_id, disputer_id, explanation, voting_deadline)
    VALUES (p_market_id, p_disputer_id, p_explanation, now() + interval '48 hours')
    RETURNING id INTO v_dispute_id;

    UPDATE markets SET status = 'disputed' WHERE id = p_market_id;

    RETURN jsonb_build_object(
        'id', v_dispute_id,
        'market_id', p_market_id,
        'disputer_id', p_disputer_id,
        'explanation', p_explanation,
        'voting_deadline', now() + interval '48 hours'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

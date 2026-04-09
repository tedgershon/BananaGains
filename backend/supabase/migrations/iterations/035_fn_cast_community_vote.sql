CREATE OR REPLACE FUNCTION cast_community_vote(
    p_market_id UUID,
    p_voter_id  UUID,
    p_vote      TEXT
) RETURNS JSONB AS $$
DECLARE
    v_status TEXT;
    v_resolution_end TIMESTAMPTZ;
    v_creator_id UUID;
    v_vote_id UUID;
BEGIN
    IF p_vote NOT IN ('YES', 'NO') THEN
        RAISE EXCEPTION 'Invalid vote: must be YES or NO';
    END IF;

    SELECT status, resolution_window_end, creator_id
    INTO v_status, v_resolution_end, v_creator_id
    FROM markets WHERE id = p_market_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Market not found';
    END IF;

    -- Allow voting during closed, pending_resolution states while within resolution window
    IF v_status NOT IN ('closed', 'pending_resolution') THEN
        RAISE EXCEPTION 'Market is not in the resolution period';
    END IF;

    IF v_resolution_end IS NULL THEN
        RAISE EXCEPTION 'Resolution window has not been set for this market';
    END IF;

    IF now() >= v_resolution_end THEN
        RAISE EXCEPTION 'Resolution voting window has expired';
    END IF;

    IF p_voter_id = v_creator_id THEN
        RAISE EXCEPTION 'Market creators cannot cast community votes on their own market';
    END IF;

    INSERT INTO community_votes (market_id, voter_id, selected_outcome)
    VALUES (p_market_id, p_voter_id, p_vote)
    RETURNING id INTO v_vote_id;

    RETURN jsonb_build_object(
        'id', v_vote_id,
        'market_id', p_market_id,
        'voter_id', p_voter_id,
        'selected_outcome', p_vote
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

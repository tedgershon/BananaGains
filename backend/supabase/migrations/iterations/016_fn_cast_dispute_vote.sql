-- 016: function — cast a vote on a dispute (neutral users only)

CREATE OR REPLACE FUNCTION cast_dispute_vote(
    p_dispute_id UUID,
    p_voter_id   UUID,
    p_vote       TEXT
) RETURNS JSONB AS $$
DECLARE
    v_market_id       UUID;
    v_market_status   TEXT;
    v_creator_id      UUID;
    v_voting_deadline TIMESTAMPTZ;
    v_vote_id         UUID;
BEGIN
    IF p_vote NOT IN ('YES', 'NO') THEN
        RAISE EXCEPTION 'Invalid vote: must be YES or NO';
    END IF;

    SELECT market_id, voting_deadline INTO v_market_id, v_voting_deadline
    FROM disputes WHERE id = p_dispute_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Dispute not found';
    END IF;

    IF now() >= v_voting_deadline THEN
        RAISE EXCEPTION 'Voting window has expired';
    END IF;

    SELECT status, creator_id INTO v_market_status, v_creator_id
    FROM markets WHERE id = v_market_id;

    IF v_market_status != 'disputed' THEN
        RAISE EXCEPTION 'Market is not in disputed status';
    END IF;

    -- neutrality: not the creator
    IF p_voter_id = v_creator_id THEN
        RAISE EXCEPTION 'Market creator cannot vote on disputes';
    END IF;

    -- neutrality: not a bettor
    IF EXISTS (SELECT 1 FROM bets WHERE market_id = v_market_id AND user_id = p_voter_id) THEN
        RAISE EXCEPTION 'Users who placed bets cannot vote on disputes';
    END IF;

    INSERT INTO resolution_votes (dispute_id, market_id, voter_id, selected_outcome)
    VALUES (p_dispute_id, v_market_id, p_voter_id, p_vote)
    RETURNING id INTO v_vote_id;

    RETURN jsonb_build_object(
        'id', v_vote_id,
        'dispute_id', p_dispute_id,
        'market_id', v_market_id,
        'voter_id', p_voter_id,
        'selected_outcome', p_vote
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 028: Function to deny a market (admin only)

CREATE OR REPLACE FUNCTION deny_market(
    p_market_id UUID,
    p_admin_id UUID,
    p_notes TEXT
) RETURNS JSONB AS $$
DECLARE
    v_status TEXT;
BEGIN
    SELECT status INTO v_status FROM markets WHERE id = p_market_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Market not found';
    END IF;

    IF v_status != 'pending_review' THEN
        RAISE EXCEPTION 'Market is not pending review (current status: %)', v_status;
    END IF;

    IF p_notes IS NULL OR trim(p_notes) = '' THEN
        RAISE EXCEPTION 'Notes are required when denying a market';
    END IF;

    UPDATE markets SET
        status = 'denied',
        reviewed_by = p_admin_id,
        review_date = now(),
        review_notes = p_notes
    WHERE id = p_market_id;

    RETURN jsonb_build_object(
        'market_id', p_market_id,
        'status', 'denied',
        'reviewed_by', p_admin_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

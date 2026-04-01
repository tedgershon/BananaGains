-- 017: function — admin makes final resolution call

CREATE OR REPLACE FUNCTION admin_resolve_market(
    p_market_id UUID,
    p_outcome   TEXT,
    p_admin_id  UUID
) RETURNS JSONB AS $$
DECLARE
    v_status   TEXT;
    v_is_admin BOOLEAN;
BEGIN
    IF p_outcome NOT IN ('YES', 'NO') THEN
        RAISE EXCEPTION 'Invalid outcome: must be YES or NO';
    END IF;

    SELECT status INTO v_status FROM markets WHERE id = p_market_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Market not found';
    END IF;

    IF v_status != 'admin_review' THEN
        RAISE EXCEPTION 'Market is not in admin_review status';
    END IF;

    SELECT is_admin INTO v_is_admin FROM profiles WHERE id = p_admin_id;

    IF v_is_admin IS NOT TRUE THEN
        RAISE EXCEPTION 'Only admins can resolve markets in admin review';
    END IF;

    UPDATE disputes SET resolved_by_admin = TRUE WHERE market_id = p_market_id;

    RETURN finalize_resolution(p_market_id, p_outcome);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

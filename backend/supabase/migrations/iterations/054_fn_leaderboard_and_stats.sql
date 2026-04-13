-- Server-side aggregations for the gains leaderboard and per-user badge stats.
-- Replaces two N+1 patterns that previously fetched raw rows and aggregated in
-- Python:
--   * backend/routers/leaderboard.py :: _get_gains_leaderboard
--   * backend/routers/rewards.py     :: _get_user_stats

-- ---------------------------------------------------------------------------
-- get_gains_leaderboard: sum payout transactions since a cutoff, return top N
-- users (by positive gains) joined with their profile info.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_gains_leaderboard(
    p_since TIMESTAMPTZ,
    p_limit INTEGER
) RETURNS TABLE (
    id UUID,
    andrew_id TEXT,
    display_name TEXT,
    banana_balance NUMERIC,
    gains NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    WITH agg AS (
        SELECT t.user_id AS uid, SUM(t.amount)::NUMERIC AS total
        FROM transactions t
        WHERE t.transaction_type = 'payout'
          AND (p_since IS NULL OR t.created_at >= p_since)
        GROUP BY t.user_id
        HAVING SUM(t.amount) > 0
    )
    SELECT
        p.id,
        p.andrew_id,
        p.display_name,
        p.banana_balance,
        ROUND(a.total, 2) AS gains
    FROM agg a
    JOIN profiles p ON p.id = a.uid
    ORDER BY a.total DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ---------------------------------------------------------------------------
-- get_user_badge_stats: single-query version of the 4-query _get_user_stats.
-- Returns the current progress value for each badge track for a given user.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_user_badge_stats(
    p_user_id UUID
) RETURNS TABLE (
    banana_baron NUMERIC,
    oracle BIGINT,
    architect BIGINT,
    degen BIGINT,
    whale NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COALESCE((SELECT banana_balance FROM profiles WHERE id = p_user_id), 0)::NUMERIC
            AS banana_baron,
        (
            SELECT COUNT(*)
            FROM bets b
            JOIN markets m ON b.market_id = m.id
            WHERE b.user_id = p_user_id
              AND m.status = 'resolved'
              AND b.side = m.resolved_outcome
        ) AS oracle,
        (
            SELECT COUNT(*)
            FROM markets
            WHERE creator_id = p_user_id
              AND status NOT IN ('pending_review', 'denied')
        ) AS architect,
        (
            SELECT COUNT(*)
            FROM bets
            WHERE user_id = p_user_id
        ) AS degen,
        COALESCE(
            (SELECT MAX(amount) FROM bets WHERE user_id = p_user_id),
            0
        )::NUMERIC AS whale;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

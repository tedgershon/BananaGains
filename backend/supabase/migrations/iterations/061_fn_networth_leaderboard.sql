-- Net-worth leaderboard: balance + open stakes on unresolved markets.
-- Rationale: ranking by profiles.banana_balance alone penalises active traders
-- because bet_placement deducts from balance and stakes don't return until
-- payout. In a pari-mutuel pool the mark-to-market value of an open bet is
-- just its stake, so we add active stakes back to get a fair score.

CREATE OR REPLACE FUNCTION public.get_networth_leaderboard(p_limit integer)
RETURNS TABLE (
    id uuid,
    andrew_id text,
    display_name text,
    banana_balance numeric,
    net_worth numeric,
    equipped_badge_id uuid,
    equipped_badges jsonb,
    avatar_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    WITH open_stakes AS (
        SELECT b.user_id, COALESCE(SUM(b.amount), 0) AS stake
        FROM bets b
        JOIN markets m ON m.id = b.market_id
        WHERE m.status NOT IN ('resolved', 'denied')
        GROUP BY b.user_id
    )
    SELECT
        p.id,
        p.andrew_id,
        p.display_name,
        p.banana_balance,
        p.banana_balance + COALESCE(s.stake, 0) AS net_worth,
        p.equipped_badge_id,
        p.equipped_badges,
        p.avatar_url
    FROM profiles p
    LEFT JOIN open_stakes s ON s.user_id = p.id
    ORDER BY net_worth DESC
    LIMIT p_limit;
$$;

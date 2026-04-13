-- Gain-in-coins leaderboard: net_worth - deposits.
--
-- Net worth = banana_balance + sum of stake on unresolved bets. In a
-- pari-mutuel pool the mark-to-market value of an open bet is its stake,
-- so adding stakes back is the fair valuation.
--
-- Deposits = sum of initial_grant + daily_claim transactions. Subtracting
-- these strips out "free money" from sign-ins so the number reflects
-- trading skill alone, not tenure on the platform.
--
-- Ranked by gain desc; can be negative for users sitting on losses.

DROP FUNCTION IF EXISTS public.get_networth_leaderboard(integer);

CREATE FUNCTION public.get_networth_leaderboard(p_limit integer)
RETURNS TABLE (
    id uuid,
    andrew_id text,
    display_name text,
    banana_balance numeric,
    gain numeric,
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
    ),
    deposits AS (
        SELECT t.user_id, COALESCE(SUM(t.amount), 0) AS total
        FROM transactions t
        WHERE t.transaction_type IN ('initial_grant', 'daily_claim')
        GROUP BY t.user_id
    )
    SELECT
        p.id,
        p.andrew_id,
        p.display_name,
        p.banana_balance,
        (p.banana_balance + COALESCE(s.stake, 0) - COALESCE(d.total, 0)) AS gain,
        p.equipped_badge_id,
        p.equipped_badges,
        p.avatar_url
    FROM profiles p
    LEFT JOIN open_stakes s ON s.user_id = p.id
    LEFT JOIN deposits d ON d.user_id = p.id
    ORDER BY gain DESC
    LIMIT p_limit;
$$;

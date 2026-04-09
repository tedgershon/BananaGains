-- Check and award badges for a user based on their current stats
CREATE OR REPLACE FUNCTION check_and_award_badges(
    p_user_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_balance NUMERIC;
    v_correct_bets INTEGER;
    v_markets_created INTEGER;
    v_total_bets INTEGER;
    v_max_single_bet NUMERIC;
    v_badge RECORD;
    v_new_badges JSONB := '[]'::JSONB;
BEGIN
    -- Get user stats
    SELECT banana_balance INTO v_balance FROM profiles WHERE id = p_user_id;

    -- Count correct predictions (bets on markets that resolved in their favor)
    SELECT COUNT(*) INTO v_correct_bets
    FROM bets b JOIN markets m ON b.market_id = m.id
    WHERE b.user_id = p_user_id
      AND m.status = 'resolved'
      AND b.side = m.resolved_outcome;

    -- Count approved markets created
    SELECT COUNT(*) INTO v_markets_created
    FROM markets
    WHERE creator_id = p_user_id
      AND status NOT IN ('pending_review', 'denied');

    -- Count total bets
    SELECT COUNT(*) INTO v_total_bets FROM bets WHERE user_id = p_user_id;

    -- Max single bet amount
    SELECT COALESCE(MAX(amount), 0) INTO v_max_single_bet FROM bets WHERE user_id = p_user_id;

    -- Check each track
    FOR v_badge IN
        SELECT * FROM badge_definitions ORDER BY track, tier DESC
    LOOP
        DECLARE
            v_current_value NUMERIC;
            v_current_tier INTEGER;
        BEGIN
            -- Get current stat for this track
            v_current_value := CASE v_badge.track
                WHEN 'banana_baron' THEN v_balance
                WHEN 'oracle' THEN v_correct_bets
                WHEN 'architect' THEN v_markets_created
                WHEN 'degen' THEN v_total_bets
                WHEN 'whale' THEN v_max_single_bet
            END;

            -- Check if user qualifies for this tier
            IF v_current_value >= v_badge.threshold THEN
                -- Check if user already has this or higher tier
                SELECT tier INTO v_current_tier
                FROM user_badges WHERE user_id = p_user_id AND track = v_badge.track;

                IF NOT FOUND OR v_current_tier < v_badge.tier THEN
                    -- Award or upgrade badge
                    INSERT INTO user_badges (user_id, badge_id, track, tier)
                    VALUES (p_user_id, v_badge.id, v_badge.track, v_badge.tier)
                    ON CONFLICT (user_id, track)
                    DO UPDATE SET badge_id = v_badge.id, tier = v_badge.tier, earned_at = now();

                    v_new_badges := v_new_badges || jsonb_build_object(
                        'track', v_badge.track,
                        'tier', v_badge.tier,
                        'name', v_badge.name
                    );
                END IF;

                -- Skip lower tiers of same track (we iterate desc)
                CONTINUE;
            END IF;
        END;
    END LOOP;

    RETURN v_new_badges;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

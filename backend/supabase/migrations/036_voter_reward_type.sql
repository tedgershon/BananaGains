-- Add resolution_vote_reward to transaction types if not present
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_transaction_type_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_transaction_type_check
    CHECK (transaction_type IN (
        'initial_grant', 'bet_placement', 'payout',
        'voter_stake', 'voter_reward', 'daily_claim',
        'resolution_vote_reward'
    ));

-- Atomically distribute voter rewards to winning voters
CREATE OR REPLACE FUNCTION distribute_voter_rewards(
    p_market_id       UUID,
    p_winning_outcome TEXT,
    p_reward_pct      NUMERIC DEFAULT 0.04
) RETURNS void AS $$
DECLARE
    v_total_pool   NUMERIC;
    v_reward_pool  NUMERIC;
    v_winner_count INTEGER;
    v_reward_each  NUMERIC;
    v_voter        RECORD;
BEGIN
    SELECT yes_pool_total + no_pool_total INTO v_total_pool
    FROM markets WHERE id = p_market_id;

    IF v_total_pool IS NULL OR v_total_pool <= 0 THEN
        RETURN;
    END IF;

    v_reward_pool := v_total_pool * p_reward_pct;

    SELECT count(*) INTO v_winner_count
    FROM community_votes
    WHERE market_id = p_market_id AND selected_outcome = p_winning_outcome;

    IF v_winner_count = 0 THEN
        RETURN;
    END IF;

    v_reward_each := round(v_reward_pool / v_winner_count, 2);

    IF v_reward_each <= 0 THEN
        RETURN;
    END IF;

    FOR v_voter IN
        SELECT voter_id FROM community_votes
        WHERE market_id = p_market_id AND selected_outcome = p_winning_outcome
    LOOP
        UPDATE profiles
        SET banana_balance = banana_balance + v_reward_each
        WHERE id = v_voter.voter_id;

        INSERT INTO transactions (user_id, market_id, transaction_type, amount)
        VALUES (v_voter.voter_id, p_market_id, 'resolution_vote_reward', v_reward_each);
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

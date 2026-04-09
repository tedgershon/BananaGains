-- ============================================================================
-- CONSOLIDATED MIGRATION: 021 through 049
-- BananaGains — All features from role system to admin backroll
-- ============================================================================
-- This file concatenates every migration from 021 to 049 (inclusive) in
-- numerical order.  Migrations that don't exist on disk are skipped.
--
-- Included migrations (25 files):
--   021  Role System
--   022  Admin RLS Policies
--   025  Market Approval Workflow
--   026  Market Review Columns
--   027  fn_approve_market
--   028  fn_deny_market
--   029  Market Type
--   030  Market Options
--   031  Multichoice Bets
--   032  fn_place_multichoice_bet
--   033  fn_resolve_multichoice
--   034  Resolution Window
--   035  fn_cast_community_vote
--   036  Voter Reward Type
--   037  fn_auto_resolution_window
--   038  fn_claim_daily_capped
--   039  fn_check_claim_eligibility
--   041  Notifications Table
--   042  fn_unread_count
--   044  Badge Definitions
--   045  User Badges
--   046  fn_check_badges
--   047  Harden place_bet
--   048  Restrict Market Updates
--   049  fn_admin_backroll
--
-- Safe to run in one go in the Supabase SQL Editor.
-- Each section is idempotent where possible (IF NOT EXISTS, CREATE OR REPLACE,
-- DROP … IF EXISTS).
-- ============================================================================

BEGIN;

-- === Migration 021: Role System ===

-- Replace boolean is_admin with a proper role column
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user'
    CHECK (role IN ('user', 'admin', 'super_admin'));

-- Migrate existing admin flags
UPDATE profiles SET role = 'admin' WHERE is_admin = TRUE;

-- Seed the super admin account (tgershon)
UPDATE profiles SET role = 'super_admin' WHERE andrew_id = 'tgershon';

-- Keep is_admin as a computed convenience for backward compatibility
CREATE OR REPLACE FUNCTION profiles_is_admin_sync()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.is_admin := NEW.role IN ('admin', 'super_admin');
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_is_admin ON profiles;
CREATE TRIGGER sync_is_admin
    BEFORE INSERT OR UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION profiles_is_admin_sync();


-- === Migration 022: Admin RLS Policies ===

-- Admins can update any market (needed for review workflow)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'markets' AND policyname = 'Admins can update any market') THEN
        CREATE POLICY "Admins can update any market"
            ON markets FOR UPDATE
            USING (
                EXISTS (
                    SELECT 1 FROM profiles
                    WHERE profiles.id = auth.uid()
                    AND profiles.role IN ('admin', 'super_admin')
                )
            );
    END IF;
END $$;

-- Admins can view all transactions (for statistics)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'transactions' AND policyname = 'Admins can view all transactions') THEN
        CREATE POLICY "Admins can view all transactions"
            ON transactions FOR SELECT
            USING (
                auth.uid() = user_id
                OR EXISTS (
                    SELECT 1 FROM profiles
                    WHERE profiles.id = auth.uid()
                    AND profiles.role IN ('admin', 'super_admin')
                )
            );
    END IF;
END $$;

-- Super admin can update any profile's role
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Super admin can update any profile') THEN
        CREATE POLICY "Super admin can update any profile"
            ON profiles FOR UPDATE
            USING (
                auth.uid() = id
                OR EXISTS (
                    SELECT 1 FROM profiles
                    WHERE profiles.id = auth.uid()
                    AND profiles.role = 'super_admin'
                )
            );
    END IF;
END $$;


-- === Migration 025: Market Approval Workflow ===

ALTER TABLE markets DROP CONSTRAINT IF EXISTS markets_status_check;
ALTER TABLE markets ADD CONSTRAINT markets_status_check
    CHECK (status IN (
        'pending_review', 'open', 'closed',
        'pending_resolution', 'disputed', 'admin_review', 'resolved',
        'denied'
    ));

ALTER TABLE markets ALTER COLUMN status SET DEFAULT 'pending_review';


-- === Migration 026: Market Review Columns ===

ALTER TABLE markets ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES profiles(id);
ALTER TABLE markets ADD COLUMN IF NOT EXISTS review_date TIMESTAMPTZ;
ALTER TABLE markets ADD COLUMN IF NOT EXISTS review_notes TEXT;
ALTER TABLE markets ADD COLUMN IF NOT EXISTS link TEXT;

CREATE INDEX IF NOT EXISTS idx_markets_review_status ON markets (status)
    WHERE status IN ('pending_review', 'denied');


-- === Migration 027: fn_approve_market ===

CREATE OR REPLACE FUNCTION approve_market(
    p_market_id UUID,
    p_admin_id UUID,
    p_notes TEXT DEFAULT NULL
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

    UPDATE markets SET
        status = 'open',
        reviewed_by = p_admin_id,
        review_date = now(),
        review_notes = p_notes
    WHERE id = p_market_id;

    RETURN jsonb_build_object(
        'market_id', p_market_id,
        'status', 'open',
        'reviewed_by', p_admin_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- === Migration 028: fn_deny_market ===

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


-- === Migration 029: Market Type ===

ALTER TABLE markets ADD COLUMN IF NOT EXISTS market_type TEXT NOT NULL DEFAULT 'binary'
    CHECK (market_type IN ('binary', 'multichoice'));

ALTER TABLE markets ADD COLUMN IF NOT EXISTS multichoice_type TEXT
    CHECK (multichoice_type IN ('exclusive', 'non_exclusive'));


-- === Migration 030: Market Options ===

CREATE TABLE IF NOT EXISTS market_options (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    market_id   UUID NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
    label       TEXT NOT NULL,
    pool_total  NUMERIC NOT NULL DEFAULT 0,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    is_winner   BOOLEAN,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_market_options_market_id ON market_options (market_id);

ALTER TABLE market_options ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'market_options' AND policyname = 'Market options are viewable by everyone') THEN
        CREATE POLICY "Market options are viewable by everyone"
            ON market_options FOR SELECT USING (true);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'market_options' AND policyname = 'Authenticated users can create options with markets') THEN
        CREATE POLICY "Authenticated users can create options with markets"
            ON market_options FOR INSERT WITH CHECK (
                EXISTS (
                    SELECT 1 FROM markets WHERE markets.id = market_id AND markets.creator_id = auth.uid()
                )
            );
    END IF;
END $$;


-- === Migration 031: Multichoice Bets ===

ALTER TABLE bets ADD COLUMN IF NOT EXISTS option_id UUID REFERENCES market_options(id);

ALTER TABLE bets DROP CONSTRAINT IF EXISTS bets_side_check;
ALTER TABLE bets DROP CONSTRAINT IF EXISTS bets_side_or_option_check;
ALTER TABLE bets ADD CONSTRAINT bets_side_or_option_check
    CHECK (
        (side IS NOT NULL AND option_id IS NULL)
        OR (side IS NULL AND option_id IS NOT NULL)
    );


-- === Migration 032: fn_place_multichoice_bet ===

CREATE OR REPLACE FUNCTION place_multichoice_bet(
    p_user_id   UUID,
    p_market_id UUID,
    p_option_id UUID,
    p_amount    NUMERIC
) RETURNS JSONB AS $$
DECLARE
    v_balance       NUMERIC;
    v_market_status TEXT;
    v_market_type   TEXT;
    v_option_market UUID;
    v_bet_id        UUID;
BEGIN
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Bet amount must be positive';
    END IF;

    SELECT market_id INTO v_option_market
    FROM market_options WHERE id = p_option_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Option not found';
    END IF;

    IF v_option_market != p_market_id THEN
        RAISE EXCEPTION 'Option does not belong to this market';
    END IF;

    SELECT banana_balance INTO v_balance
    FROM profiles WHERE id = p_user_id FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'User not found'; END IF;
    IF v_balance < p_amount THEN RAISE EXCEPTION 'Insufficient balance'; END IF;

    SELECT status, market_type INTO v_market_status, v_market_type
    FROM markets WHERE id = p_market_id FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Market not found'; END IF;
    IF v_market_status != 'open' THEN RAISE EXCEPTION 'Market is not open for betting'; END IF;
    IF v_market_type != 'multichoice' THEN RAISE EXCEPTION 'Market is not multichoice'; END IF;

    UPDATE profiles SET banana_balance = banana_balance - p_amount WHERE id = p_user_id;

    UPDATE market_options SET pool_total = pool_total + p_amount WHERE id = p_option_id;

    INSERT INTO bets (user_id, market_id, option_id, amount)
    VALUES (p_user_id, p_market_id, p_option_id, p_amount)
    RETURNING id INTO v_bet_id;

    INSERT INTO transactions (user_id, market_id, transaction_type, amount)
    VALUES (p_user_id, p_market_id, 'bet_placement', -p_amount);

    RETURN jsonb_build_object(
        'bet_id', v_bet_id,
        'new_balance', v_balance - p_amount
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- === Migration 033: fn_resolve_multichoice ===

CREATE OR REPLACE FUNCTION resolve_multichoice_market(
    p_market_id UUID,
    p_winning_option_ids UUID[]
) RETURNS JSONB AS $$
DECLARE
    v_market_type TEXT;
    v_multichoice_type TEXT;
    v_status TEXT;
    v_total_pool NUMERIC := 0;
    v_winning_pool NUMERIC := 0;
    v_opt RECORD;
    v_bet RECORD;
    v_payout NUMERIC;
BEGIN
    SELECT market_type, multichoice_type, status
    INTO v_market_type, v_multichoice_type, v_status
    FROM markets WHERE id = p_market_id FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Market not found'; END IF;
    IF v_market_type != 'multichoice' THEN RAISE EXCEPTION 'Not a multichoice market'; END IF;
    IF v_status NOT IN ('pending_resolution', 'disputed', 'admin_review', 'closed') THEN
        RAISE EXCEPTION 'Market cannot be resolved from status: %', v_status;
    END IF;

    IF v_multichoice_type = 'exclusive' AND array_length(p_winning_option_ids, 1) != 1 THEN
        RAISE EXCEPTION 'Exclusive markets must have exactly one winner';
    END IF;

    UPDATE market_options SET is_winner = FALSE WHERE market_id = p_market_id;
    UPDATE market_options SET is_winner = TRUE WHERE id = ANY(p_winning_option_ids);

    SELECT COALESCE(SUM(pool_total), 0) INTO v_total_pool
    FROM market_options WHERE market_id = p_market_id;

    SELECT COALESCE(SUM(pool_total), 0) INTO v_winning_pool
    FROM market_options WHERE id = ANY(p_winning_option_ids);

    UPDATE markets SET
        status = 'resolved',
        resolved_at = now()
    WHERE id = p_market_id;

    IF v_winning_pool = 0 THEN
        FOR v_bet IN
            SELECT user_id, amount FROM bets WHERE market_id = p_market_id
        LOOP
            UPDATE profiles SET banana_balance = banana_balance + v_bet.amount WHERE id = v_bet.user_id;
            INSERT INTO transactions (user_id, market_id, transaction_type, amount)
            VALUES (v_bet.user_id, p_market_id, 'payout', v_bet.amount);
        END LOOP;
    ELSE
        FOR v_bet IN
            SELECT user_id, SUM(amount) AS user_total
            FROM bets
            WHERE market_id = p_market_id AND option_id = ANY(p_winning_option_ids)
            GROUP BY user_id
        LOOP
            v_payout := TRUNC(v_bet.user_total * (v_total_pool / v_winning_pool), 2);
            UPDATE profiles SET banana_balance = banana_balance + v_payout WHERE id = v_bet.user_id;
            INSERT INTO transactions (user_id, market_id, transaction_type, amount)
            VALUES (v_bet.user_id, p_market_id, 'payout', v_payout);
        END LOOP;
    END IF;

    RETURN jsonb_build_object(
        'market_id', p_market_id,
        'status', 'resolved',
        'winning_options', p_winning_option_ids
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- === Migration 034: Resolution Window ===

ALTER TABLE markets ADD COLUMN IF NOT EXISTS resolution_window_end TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS community_votes (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    market_id         UUID NOT NULL REFERENCES markets(id),
    voter_id          UUID NOT NULL REFERENCES profiles(id),
    selected_outcome  TEXT NOT NULL CHECK (selected_outcome IN ('YES', 'NO')),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (market_id, voter_id)
);

CREATE INDEX IF NOT EXISTS idx_community_votes_market_id ON community_votes (market_id);

ALTER TABLE community_votes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'community_votes' AND policyname = 'Community votes are viewable by everyone') THEN
        CREATE POLICY "Community votes are viewable by everyone"
            ON community_votes FOR SELECT USING (true);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'community_votes' AND policyname = 'Authenticated users can cast community votes') THEN
        CREATE POLICY "Authenticated users can cast community votes"
            ON community_votes FOR INSERT WITH CHECK (auth.uid() = voter_id);
    END IF;
END $$;


-- === Migration 035: fn_cast_community_vote ===

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


-- === Migration 036: Voter Reward Type ===

ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_transaction_type_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_transaction_type_check
    CHECK (transaction_type IN (
        'initial_grant', 'bet_placement', 'payout',
        'voter_stake', 'voter_reward', 'daily_claim',
        'resolution_vote_reward'
    ));

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


-- === Migration 037: fn_auto_resolution_window ===

CREATE OR REPLACE FUNCTION set_resolution_window()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.status = 'closed' AND OLD.status = 'open' AND NEW.resolution_window_end IS NULL THEN
        NEW.resolution_window_end := now() + interval '24 hours';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_set_resolution_window ON markets;
CREATE TRIGGER auto_set_resolution_window
    BEFORE UPDATE ON markets
    FOR EACH ROW EXECUTE FUNCTION set_resolution_window();

CREATE OR REPLACE FUNCTION close_expired_markets()
RETURNS void AS $$
BEGIN
    UPDATE markets
    SET status = 'closed',
        resolution_window_end = now() + interval '24 hours'
    WHERE status = 'open'
      AND close_at <= now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- === Migration 038: fn_claim_daily_capped ===

CREATE OR REPLACE FUNCTION claim_daily_bananas(
    p_user_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_today   DATE;
    v_balance NUMERIC;
    v_claim_amount NUMERIC;
    v_cap NUMERIC := 5000;
BEGIN
    v_today := (now() AT TIME ZONE 'America/New_York')::date;

    SELECT banana_balance INTO v_balance FROM profiles WHERE id = p_user_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User not found';
    END IF;

    IF EXISTS (
        SELECT 1 FROM transactions
        WHERE user_id = p_user_id
          AND transaction_type = 'daily_claim'
          AND (created_at AT TIME ZONE 'America/New_York')::date = v_today
    ) THEN
        RAISE EXCEPTION 'Already claimed today';
    END IF;

    IF v_balance >= v_cap THEN
        RAISE EXCEPTION 'Balance is at or above the daily claim cap of 5000';
    END IF;

    v_claim_amount := LEAST(1000, v_cap - v_balance);

    IF v_claim_amount <= 0 THEN
        RAISE EXCEPTION 'Balance is at or above the daily claim cap of 5000';
    END IF;

    UPDATE profiles SET banana_balance = banana_balance + v_claim_amount WHERE id = p_user_id;

    INSERT INTO transactions (user_id, transaction_type, amount)
    VALUES (p_user_id, 'daily_claim', v_claim_amount);

    RETURN jsonb_build_object(
        'new_balance', v_balance + v_claim_amount,
        'claimed_amount', v_claim_amount,
        'claimed_at', now()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- === Migration 039: fn_check_claim_eligibility ===

CREATE OR REPLACE FUNCTION check_claim_eligibility(
    p_user_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_today DATE;
    v_balance NUMERIC;
    v_claimed_today BOOLEAN;
    v_eligible BOOLEAN;
    v_claim_amount NUMERIC;
    v_cap NUMERIC := 5000;
BEGIN
    v_today := (now() AT TIME ZONE 'America/New_York')::date;

    SELECT banana_balance INTO v_balance FROM profiles WHERE id = p_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User not found';
    END IF;

    v_claimed_today := EXISTS (
        SELECT 1 FROM transactions
        WHERE user_id = p_user_id
          AND transaction_type = 'daily_claim'
          AND (created_at AT TIME ZONE 'America/New_York')::date = v_today
    );

    v_eligible := NOT v_claimed_today AND v_balance < v_cap;
    v_claim_amount := CASE
        WHEN NOT v_eligible THEN 0
        ELSE LEAST(1000, v_cap - v_balance)
    END;

    RETURN jsonb_build_object(
        'eligible', v_eligible,
        'claimed_today', v_claimed_today,
        'balance', v_balance,
        'claim_amount', v_claim_amount,
        'cap', v_cap,
        'above_cap', v_balance >= v_cap
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- === Migration 041: Notifications Table ===

CREATE TABLE IF NOT EXISTS notifications (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    type        TEXT NOT NULL CHECK (type IN (
        'market_approved', 'market_denied', 'market_closed',
        'market_resolved', 'payout_received',
        'badge_earned', 'system'
    )),
    title       TEXT NOT NULL,
    body        TEXT NOT NULL,
    metadata    JSONB DEFAULT '{}',
    is_read     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications (user_id, is_read)
    WHERE is_read = FALSE;

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'Users can view own notifications') THEN
        CREATE POLICY "Users can view own notifications"
            ON notifications FOR SELECT USING (auth.uid() = user_id);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'Users can update own notifications') THEN
        CREATE POLICY "Users can update own notifications"
            ON notifications FOR UPDATE USING (auth.uid() = user_id);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'System can insert notifications') THEN
        CREATE POLICY "System can insert notifications"
            ON notifications FOR INSERT WITH CHECK (true);
    END IF;
END $$;


-- === Migration 042: fn_unread_count ===

CREATE OR REPLACE FUNCTION get_unread_notification_count(
    p_user_id UUID
) RETURNS INTEGER AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)::INTEGER
        FROM notifications
        WHERE user_id = p_user_id AND is_read = FALSE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- === Migration 044: Badge Definitions ===

CREATE TABLE IF NOT EXISTS badge_definitions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    track       TEXT NOT NULL,
    tier        INTEGER NOT NULL CHECK (tier BETWEEN 1 AND 5),
    name        TEXT NOT NULL,
    description TEXT NOT NULL,
    threshold   NUMERIC NOT NULL,
    color       TEXT NOT NULL,
    UNIQUE (track, tier)
);

INSERT INTO badge_definitions (track, tier, name, description, threshold, color) VALUES
('banana_baron', 1, 'Banana Sprout',   'Reach 5,000 coin balance',      5000,  '#4ade80'),
('banana_baron', 2, 'Banana Tree',     'Reach 7,500 coin balance',      7500,  '#a3e635'),
('banana_baron', 3, 'Banana Grove',    'Reach 10,000 coin balance',     10000, '#eab308'),
('banana_baron', 4, 'Banana Mogul',    'Reach 20,000 coin balance',     20000, '#f59e0b'),
('banana_baron', 5, 'Banana Baron',    'Reach 50,000 coin balance',     50000, '#d97706'),
('oracle', 1, 'Lucky Guess',     'Win 3 correct predictions',     3,   '#93c5fd'),
('oracle', 2, 'Sharp Eye',       'Win 5 correct predictions',     5,   '#3b82f6'),
('oracle', 3, 'Fortune Teller',  'Win 10 correct predictions',    10,  '#a855f7'),
('oracle', 4, 'Clairvoyant',     'Win 20 correct predictions',    20,  '#7c3aed'),
('oracle', 5, 'Oracle',          'Win 50 correct predictions',    50,  '#4f46e5'),
('architect', 1, 'Market Maker',    'Create 1 approved market',      1,   '#5eead4'),
('architect', 2, 'Question Crafter','Create 2 approved markets',     2,   '#14b8a6'),
('architect', 3, 'Trend Setter',    'Create 5 approved markets',     5,   '#06b6d4'),
('architect', 4, 'Market Maven',    'Create 10 approved markets',    10,  '#0d9488'),
('architect', 5, 'Architect',       'Create 25 approved markets',    25,  '#0f766e'),
('degen', 1, 'Casual Better', 'Place 5 bets',               5,   '#fdba74'),
('degen', 2, 'Regular',       'Place 10 bets',              10,  '#fb923c'),
('degen', 3, 'Enthusiast',    'Place 20 bets',              20,  '#f97316'),
('degen', 4, 'Addicted',      'Place 50 bets',              50,  '#ea580c'),
('degen', 5, 'Degen',         'Place 100 bets',             100, '#dc2626'),
('whale', 1, 'Small Fish', 'Place a single bet of 1,000+',   1000,  '#f9a8d4'),
('whale', 2, 'Dolphin',    'Place a single bet of 2,000+',   2000,  '#f472b6'),
('whale', 3, 'Shark',      'Place a single bet of 5,000+',   5000,  '#ec4899'),
('whale', 4, 'Orca',       'Place a single bet of 10,000+',  10000, '#db2777'),
('whale', 5, 'Whale',      'Place a single bet of 25,000+',  25000, '#be185d')
ON CONFLICT (track, tier) DO NOTHING;


-- === Migration 045: User Badges ===

CREATE TABLE IF NOT EXISTS user_badges (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    badge_id        UUID NOT NULL REFERENCES badge_definitions(id),
    track           TEXT NOT NULL,
    tier            INTEGER NOT NULL,
    earned_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, track)
);

CREATE INDEX IF NOT EXISTS idx_user_badges_user_id ON user_badges (user_id);

ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_badges' AND policyname = 'User badges are viewable by everyone') THEN
        CREATE POLICY "User badges are viewable by everyone"
            ON user_badges FOR SELECT USING (true);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_badges' AND policyname = 'System can manage user badges') THEN
        CREATE POLICY "System can manage user badges"
            ON user_badges FOR ALL WITH CHECK (true);
    END IF;
END $$;


-- === Migration 046: fn_check_badges ===

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
    SELECT banana_balance INTO v_balance FROM profiles WHERE id = p_user_id;

    SELECT COUNT(*) INTO v_correct_bets
    FROM bets b JOIN markets m ON b.market_id = m.id
    WHERE b.user_id = p_user_id
      AND m.status = 'resolved'
      AND b.side = m.resolved_outcome;

    SELECT COUNT(*) INTO v_markets_created
    FROM markets
    WHERE creator_id = p_user_id
      AND status NOT IN ('pending_review', 'denied');

    SELECT COUNT(*) INTO v_total_bets FROM bets WHERE user_id = p_user_id;

    SELECT COALESCE(MAX(amount), 0) INTO v_max_single_bet FROM bets WHERE user_id = p_user_id;

    FOR v_badge IN
        SELECT * FROM badge_definitions ORDER BY track, tier DESC
    LOOP
        DECLARE
            v_current_value NUMERIC;
            v_current_tier INTEGER;
        BEGIN
            v_current_value := CASE v_badge.track
                WHEN 'banana_baron' THEN v_balance
                WHEN 'oracle' THEN v_correct_bets
                WHEN 'architect' THEN v_markets_created
                WHEN 'degen' THEN v_total_bets
                WHEN 'whale' THEN v_max_single_bet
            END;

            IF v_current_value >= v_badge.threshold THEN
                SELECT tier INTO v_current_tier
                FROM user_badges WHERE user_id = p_user_id AND track = v_badge.track;

                IF NOT FOUND OR v_current_tier < v_badge.tier THEN
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

                CONTINUE;
            END IF;
        END;
    END LOOP;

    RETURN v_new_badges;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- === Migration 047: Harden place_bet ===

CREATE OR REPLACE FUNCTION place_bet(
    p_user_id   UUID,
    p_market_id UUID,
    p_side      TEXT,
    p_amount    NUMERIC
) RETURNS JSONB AS $$
DECLARE
    v_balance       NUMERIC;
    v_market_status TEXT;
    v_close_at      TIMESTAMPTZ;
    v_creator_id    UUID;
    v_bet_id        UUID;
BEGIN
    IF p_side NOT IN ('YES', 'NO') THEN
        RAISE EXCEPTION 'Invalid side: must be YES or NO';
    END IF;
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Bet amount must be positive';
    END IF;

    SELECT banana_balance INTO v_balance
    FROM profiles WHERE id = p_user_id FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'User not found'; END IF;
    IF v_balance < p_amount THEN RAISE EXCEPTION 'Insufficient balance'; END IF;

    SELECT status, close_at, creator_id INTO v_market_status, v_close_at, v_creator_id
    FROM markets WHERE id = p_market_id FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Market not found'; END IF;

    IF p_user_id = v_creator_id THEN
        RAISE EXCEPTION 'Market creators cannot place bets on their own markets';
    END IF;

    IF v_market_status != 'open' THEN
        RAISE EXCEPTION 'Market is not open for betting';
    END IF;

    IF v_close_at <= now() THEN
        UPDATE markets SET status = 'closed' WHERE id = p_market_id;
        RAISE EXCEPTION 'Market has closed';
    END IF;

    UPDATE profiles SET banana_balance = banana_balance - p_amount WHERE id = p_user_id;

    IF p_side = 'YES' THEN
        UPDATE markets SET yes_pool_total = yes_pool_total + p_amount WHERE id = p_market_id;
    ELSE
        UPDATE markets SET no_pool_total = no_pool_total + p_amount WHERE id = p_market_id;
    END IF;

    INSERT INTO bets (user_id, market_id, side, amount)
    VALUES (p_user_id, p_market_id, p_side, p_amount)
    RETURNING id INTO v_bet_id;

    INSERT INTO transactions (user_id, market_id, transaction_type, amount)
    VALUES (p_user_id, p_market_id, 'bet_placement', -p_amount);

    RETURN jsonb_build_object(
        'bet_id', v_bet_id,
        'new_balance', v_balance - p_amount
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- === Migration 048: Restrict Market Updates ===

DROP POLICY IF EXISTS "Creators can update own markets" ON markets;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'markets'
        AND policyname = 'Admins can update any market'
    ) THEN
        CREATE POLICY "Admins can update any market"
            ON markets FOR UPDATE
            USING (
                EXISTS (
                    SELECT 1 FROM profiles
                    WHERE profiles.id = auth.uid()
                    AND profiles.role IN ('admin', 'super_admin')
                )
            );
    END IF;
END $$;

CREATE OR REPLACE FUNCTION prevent_resolved_market_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF OLD.status = 'resolved' AND NEW.status = 'resolved' THEN
        IF NEW.title != OLD.title OR NEW.description != OLD.description
           OR NEW.resolution_criteria != OLD.resolution_criteria THEN
            RAISE EXCEPTION 'Cannot modify a resolved market';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_resolved_market ON markets;
CREATE TRIGGER guard_resolved_market
    BEFORE UPDATE ON markets
    FOR EACH ROW EXECUTE FUNCTION prevent_resolved_market_update();


-- === Migration 049: fn_admin_backroll ===

CREATE OR REPLACE FUNCTION admin_backroll_market(
    p_market_id   UUID,
    p_admin_id    UUID,
    p_cutoff_date TIMESTAMPTZ,
    p_close_market BOOLEAN DEFAULT TRUE
) RETURNS JSONB AS $$
DECLARE
    v_is_admin BOOLEAN;
    v_status TEXT;
    v_bet RECORD;
    v_total_refunded NUMERIC := 0;
    v_bets_cancelled INTEGER := 0;
    v_yes_refund NUMERIC := 0;
    v_no_refund NUMERIC := 0;
BEGIN
    SELECT (role IN ('admin', 'super_admin')) INTO v_is_admin
    FROM profiles WHERE id = p_admin_id;

    IF v_is_admin IS NOT TRUE THEN
        RAISE EXCEPTION 'Only admins can perform backroll';
    END IF;

    SELECT status INTO v_status FROM markets WHERE id = p_market_id FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Market not found'; END IF;

    IF v_status = 'resolved' THEN
        RAISE EXCEPTION 'Cannot backroll a resolved market. Resolve must happen after backroll.';
    END IF;

    FOR v_bet IN
        SELECT id, user_id, side, amount
        FROM bets
        WHERE market_id = p_market_id
          AND created_at > p_cutoff_date
        ORDER BY created_at DESC
    LOOP
        UPDATE profiles SET banana_balance = banana_balance + v_bet.amount
        WHERE id = v_bet.user_id;

        INSERT INTO transactions (user_id, market_id, transaction_type, amount)
        VALUES (v_bet.user_id, p_market_id, 'payout', v_bet.amount);

        IF v_bet.side = 'YES' THEN
            v_yes_refund := v_yes_refund + v_bet.amount;
        ELSE
            v_no_refund := v_no_refund + v_bet.amount;
        END IF;

        v_total_refunded := v_total_refunded + v_bet.amount;
        v_bets_cancelled := v_bets_cancelled + 1;

        DELETE FROM bets WHERE id = v_bet.id;
    END LOOP;

    UPDATE markets SET
        yes_pool_total = GREATEST(0, yes_pool_total - v_yes_refund),
        no_pool_total = GREATEST(0, no_pool_total - v_no_refund)
    WHERE id = p_market_id;

    IF p_close_market THEN
        UPDATE markets SET
            status = 'closed',
            close_at = p_cutoff_date
        WHERE id = p_market_id;
    END IF;

    RETURN jsonb_build_object(
        'market_id', p_market_id,
        'bets_cancelled', v_bets_cancelled,
        'total_refunded', v_total_refunded,
        'new_close_at', p_cutoff_date,
        'status', CASE WHEN p_close_market THEN 'closed' ELSE v_status END
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


COMMIT;

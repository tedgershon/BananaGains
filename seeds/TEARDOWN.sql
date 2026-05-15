-- seeds/TEARDOWN.sql
--
-- Companion to seeds/PLAN.md. Removes the 8 Silicon Valley fixture users
-- (rhendrix, ebachman, bgilfoyl, dchughta, jdunn, mhall, gbelson, nbighett)
-- and every market, bet, vote, dispute, transaction, and notification owned
-- by them or attached to their markets. Scoping is by Andrew ID, so real
-- OAuth signups under @andrew.cmu.edu are never touched.
--
-- This file is documentation, not auto-applied. Paste into the Supabase
-- SQL editor (or psql with service-role credentials) to run.
--
-- To preview without committing, change the final COMMIT to ROLLBACK.
-- Row-count output appears in the editor's result panel.
--
-- Delete order follows the FK graph since most FKs from referenced tables
-- to profiles/markets do NOT have ON DELETE CASCADE.

BEGIN;

CREATE TEMP TABLE fixture_user_ids ON COMMIT DROP AS
SELECT id FROM profiles
WHERE andrew_id IN (
  'rhendrix','ebachman','bgilfoyl','dchughta',
  'jdunn','mhall','gbelson','nbighett'
);

CREATE TEMP TABLE fixture_market_ids ON COMMIT DROP AS
SELECT id FROM markets
WHERE creator_id IN (SELECT id FROM fixture_user_ids);

-- Resolution + community votes (FKs: voter_id, market_id, both non-cascading)
DELETE FROM resolution_votes
 WHERE voter_id IN (SELECT id FROM fixture_user_ids)
    OR market_id IN (SELECT id FROM fixture_market_ids);

DELETE FROM community_votes
 WHERE voter_id IN (SELECT id FROM fixture_user_ids)
    OR market_id IN (SELECT id FROM fixture_market_ids);

-- Disputes (FKs: disputer_id, market_id)
DELETE FROM disputes
 WHERE disputer_id IN (SELECT id FROM fixture_user_ids)
    OR market_id IN (SELECT id FROM fixture_market_ids);

-- Bets (FKs: user_id, market_id) -- also covers fixture bets on real markets
DELETE FROM bets
 WHERE user_id IN (SELECT id FROM fixture_user_ids)
    OR market_id IN (SELECT id FROM fixture_market_ids);

-- Transactions / ledger (FKs: user_id, market_id) -- the audit trail is
-- meaningless once the user it describes is gone
DELETE FROM transactions
 WHERE user_id IN (SELECT id FROM fixture_user_ids)
    OR market_id IN (SELECT id FROM fixture_market_ids);

-- Defensive: null out reviewed_by on any non-fixture market a fixture user
-- ever reviewed. Fixtures aren't admins so this is expected 0 rows; left
-- in for safety if a fixture were ever promoted via direct UPDATE.
UPDATE markets SET reviewed_by = NULL
WHERE reviewed_by IN (SELECT id FROM fixture_user_ids)
  AND id NOT IN (SELECT id FROM fixture_market_ids);

-- Fixture markets (FKs: creator_id, reviewed_by). market_options has
-- ON DELETE CASCADE on market_id, so option rows clean up automatically.
DELETE FROM markets WHERE id IN (SELECT id FROM fixture_market_ids);

-- auth.users -- cascades down to profiles, notifications, user_badges via
-- ON DELETE CASCADE on those tables. Scoping by id (not email) means a
-- real OAuth signup that happens to share the @andrew.cmu.edu domain
-- but uses a different Andrew ID is untouched.
DELETE FROM auth.users
 WHERE id IN (SELECT id FROM fixture_user_ids);

COMMIT;

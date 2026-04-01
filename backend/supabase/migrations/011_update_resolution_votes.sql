-- 011: update resolution_votes — drop staking, add dispute link

ALTER TABLE resolution_votes DROP COLUMN IF EXISTS staked_amount;
ALTER TABLE resolution_votes ADD COLUMN IF NOT EXISTS dispute_id UUID REFERENCES disputes(id);

ALTER TABLE resolution_votes DROP CONSTRAINT IF EXISTS resolution_votes_market_id_voter_id_key;
ALTER TABLE resolution_votes ADD CONSTRAINT resolution_votes_dispute_id_voter_id_key UNIQUE (dispute_id, voter_id);

CREATE INDEX IF NOT EXISTS idx_resolution_votes_dispute_id ON resolution_votes (dispute_id);

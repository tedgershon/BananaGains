-- Add resolution window tracking
ALTER TABLE markets ADD COLUMN IF NOT EXISTS resolution_window_end TIMESTAMPTZ;

-- Track community votes separately from dispute votes
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

CREATE POLICY "Community votes are viewable by everyone"
    ON community_votes FOR SELECT USING (true);
CREATE POLICY "Authenticated users can cast community votes"
    ON community_votes FOR INSERT WITH CHECK (auth.uid() = voter_id);

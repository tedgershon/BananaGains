-- Each option in a multichoice market
CREATE TABLE IF NOT EXISTS market_options (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    market_id   UUID NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
    label       TEXT NOT NULL,
    pool_total  NUMERIC NOT NULL DEFAULT 0,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    is_winner   BOOLEAN,  -- NULL while market is open, TRUE/FALSE after resolution
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_market_options_market_id ON market_options (market_id);

ALTER TABLE market_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Market options are viewable by everyone"
    ON market_options FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create options with markets"
    ON market_options FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM markets WHERE markets.id = market_id AND markets.creator_id = auth.uid()
        )
    );

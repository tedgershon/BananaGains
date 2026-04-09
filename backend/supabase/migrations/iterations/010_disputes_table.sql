-- 010: create disputes table (one active dispute per market)

CREATE TABLE IF NOT EXISTS disputes (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    market_id        UUID NOT NULL REFERENCES markets(id) UNIQUE,
    disputer_id      UUID NOT NULL REFERENCES profiles(id),
    explanation      TEXT NOT NULL,
    voting_deadline  TIMESTAMPTZ NOT NULL,
    resolved_by_admin BOOLEAN NOT NULL DEFAULT FALSE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_disputes_market_id ON disputes (market_id);

ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Disputes are viewable by everyone"
    ON disputes FOR SELECT USING (true);
CREATE POLICY "Authenticated users can file disputes"
    ON disputes FOR INSERT WITH CHECK (auth.uid() = disputer_id);

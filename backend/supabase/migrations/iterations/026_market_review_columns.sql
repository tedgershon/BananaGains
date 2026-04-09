-- 026: Add review-related columns to markets

ALTER TABLE markets ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES profiles(id);
ALTER TABLE markets ADD COLUMN IF NOT EXISTS review_date TIMESTAMPTZ;
ALTER TABLE markets ADD COLUMN IF NOT EXISTS review_notes TEXT;
ALTER TABLE markets ADD COLUMN IF NOT EXISTS link TEXT;

-- Index for efficient admin queries
CREATE INDEX IF NOT EXISTS idx_markets_review_status ON markets (status)
    WHERE status IN ('pending_review', 'denied');

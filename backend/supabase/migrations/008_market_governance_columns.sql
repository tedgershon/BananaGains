-- 008: add resolution governance columns to markets

ALTER TABLE markets ADD COLUMN IF NOT EXISTS official_source TEXT;
ALTER TABLE markets ADD COLUMN IF NOT EXISTS yes_criteria TEXT;
ALTER TABLE markets ADD COLUMN IF NOT EXISTS no_criteria TEXT;
ALTER TABLE markets ADD COLUMN IF NOT EXISTS ambiguity_criteria TEXT;
ALTER TABLE markets ADD COLUMN IF NOT EXISTS proposed_outcome TEXT CHECK (proposed_outcome IN ('YES', 'NO'));
ALTER TABLE markets ADD COLUMN IF NOT EXISTS proposed_at TIMESTAMPTZ;
ALTER TABLE markets ADD COLUMN IF NOT EXISTS dispute_deadline TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_markets_dispute_deadline ON markets (dispute_deadline);

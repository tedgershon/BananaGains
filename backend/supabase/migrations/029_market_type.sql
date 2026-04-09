-- Add market type: binary (default, backward compat) or multichoice
ALTER TABLE markets ADD COLUMN IF NOT EXISTS market_type TEXT NOT NULL DEFAULT 'binary'
    CHECK (market_type IN ('binary', 'multichoice'));

-- For multichoice, specify whether options are mutually exclusive
ALTER TABLE markets ADD COLUMN IF NOT EXISTS multichoice_type TEXT
    CHECK (multichoice_type IN ('exclusive', 'non_exclusive'));
-- exclusive: exactly one option wins (e.g., "Who will win?")
-- non_exclusive: multiple options can be true (e.g., "Which events have >500 attendees?")

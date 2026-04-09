-- Extend bets table to support option-level betting
ALTER TABLE bets ADD COLUMN IF NOT EXISTS option_id UUID REFERENCES market_options(id);

-- For binary markets: side is 'YES'/'NO', option_id is NULL
-- For multichoice markets: side is NULL, option_id references the chosen option
ALTER TABLE bets DROP CONSTRAINT IF EXISTS bets_side_check;
ALTER TABLE bets ADD CONSTRAINT bets_side_or_option_check
    CHECK (
        (side IS NOT NULL AND option_id IS NULL)  -- binary bet
        OR (side IS NULL AND option_id IS NOT NULL)  -- multichoice bet
    );

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

-- Seed badge definitions
INSERT INTO badge_definitions (track, tier, name, description, threshold, color) VALUES
-- Banana Baron track
('banana_baron', 1, 'Banana Sprout',   'Reach 5,000 coin balance',      5000,  '#4ade80'),
('banana_baron', 2, 'Banana Tree',     'Reach 7,500 coin balance',      7500,  '#a3e635'),
('banana_baron', 3, 'Banana Grove',    'Reach 10,000 coin balance',     10000, '#eab308'),
('banana_baron', 4, 'Banana Mogul',    'Reach 20,000 coin balance',     20000, '#f59e0b'),
('banana_baron', 5, 'Banana Baron',    'Reach 50,000 coin balance',     50000, '#d97706'),
-- Oracle track
('oracle', 1, 'Lucky Guess',     'Win 3 correct predictions',     3,   '#93c5fd'),
('oracle', 2, 'Sharp Eye',       'Win 5 correct predictions',     5,   '#3b82f6'),
('oracle', 3, 'Fortune Teller',  'Win 10 correct predictions',    10,  '#a855f7'),
('oracle', 4, 'Clairvoyant',     'Win 20 correct predictions',    20,  '#7c3aed'),
('oracle', 5, 'Oracle',          'Win 50 correct predictions',    50,  '#4f46e5'),
-- Architect track
('architect', 1, 'Market Maker',    'Create 1 approved market',      1,   '#5eead4'),
('architect', 2, 'Question Crafter','Create 2 approved markets',     2,   '#14b8a6'),
('architect', 3, 'Trend Setter',    'Create 5 approved markets',     5,   '#06b6d4'),
('architect', 4, 'Market Maven',    'Create 10 approved markets',    10,  '#0d9488'),
('architect', 5, 'Architect',       'Create 25 approved markets',    25,  '#0f766e'),
-- Degen track
('degen', 1, 'Casual Better', 'Place 5 bets',               5,   '#fdba74'),
('degen', 2, 'Regular',       'Place 10 bets',              10,  '#fb923c'),
('degen', 3, 'Enthusiast',    'Place 20 bets',              20,  '#f97316'),
('degen', 4, 'Addicted',      'Place 50 bets',              50,  '#ea580c'),
('degen', 5, 'Degen',         'Place 100 bets',             100, '#dc2626'),
-- Whale track
('whale', 1, 'Small Fish', 'Place a single bet of 1,000+',   1000,  '#f9a8d4'),
('whale', 2, 'Dolphin',    'Place a single bet of 2,000+',   2000,  '#f472b6'),
('whale', 3, 'Shark',      'Place a single bet of 5,000+',   5000,  '#ec4899'),
('whale', 4, 'Orca',       'Place a single bet of 10,000+',  10000, '#db2777'),
('whale', 5, 'Whale',      'Place a single bet of 25,000+',  25000, '#be185d');

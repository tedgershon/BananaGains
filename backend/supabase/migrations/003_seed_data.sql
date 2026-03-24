-- 003_seed_data.sql
-- Seed demo users and sample markets for development and demos.
-- NOTE: In production, users are created via Supabase Auth triggers.
-- These inserts bypass auth and are for local/dev seeding only.

-- Demo users (UUIDs are deterministic for reproducibility)
INSERT INTO profiles (id, andrew_id, display_name, banana_balance) VALUES
    ('00000000-0000-0000-0000-000000000001', 'at2',      'Aaron Tang',   1000),
    ('00000000-0000-0000-0000-000000000002', 'tgershon', 'Ted Gershon',  1000),
    ('00000000-0000-0000-0000-000000000003', 'jgu2',     'Jonathan Gu',  1000)
ON CONFLICT (id) DO NOTHING;

-- Initial grant transactions
INSERT INTO transactions (user_id, transaction_type, amount) VALUES
    ('00000000-0000-0000-0000-000000000001', 'initial_grant', 1000),
    ('00000000-0000-0000-0000-000000000002', 'initial_grant', 1000),
    ('00000000-0000-0000-0000-000000000003', 'initial_grant', 1000)
ON CONFLICT DO NOTHING;

-- Sample markets
INSERT INTO markets (id, title, description, creator_id, close_at, status, resolution_criteria, category, yes_pool_total, no_pool_total) VALUES
    (
        '10000000-0000-0000-0000-000000000001',
        'Will CMU''s CS program be ranked #1 again this year?',
        'Resolves YES if CMU''s CS program is ranked #1 in the next US News ranking release.',
        '00000000-0000-0000-0000-000000000002',
        '2026-04-10 23:59:00+00',
        'open',
        'Based on the official US News & World Report ranking.',
        'Academics',
        3200, 800
    ),
    (
        '10000000-0000-0000-0000-000000000002',
        'Will Carnival have over 10,000 attendees?',
        'Resolves YES if official CMU Spring Carnival attendance exceeds 10,000 people.',
        '00000000-0000-0000-0000-000000000003',
        '2026-04-08 12:00:00+00',
        'open',
        'Based on official CMU event attendance numbers.',
        'Campus Life',
        1500, 2100
    ),
    (
        '10000000-0000-0000-0000-000000000003',
        'Will the Gates Hillman escalator break down before finals?',
        'Resolves YES if any GHC escalator is out of service for 24+ hours before finals week.',
        '00000000-0000-0000-0000-000000000001',
        '2026-04-12 23:59:00+00',
        'open',
        'Photographic evidence or official maintenance notice.',
        'Campus Life',
        4100, 500
    ),
    (
        '10000000-0000-0000-0000-000000000004',
        'Will 17-437 curve the final exam?',
        'Resolves YES if the Information Systems course 17-437 applies a curve to the final exam.',
        '00000000-0000-0000-0000-000000000002',
        '2026-04-11 23:59:00+00',
        'open',
        'Confirmed by professor announcement or syllabus update.',
        'Academics',
        900, 1100
    ),
    (
        '10000000-0000-0000-0000-000000000005',
        'Will Tartan Racing win the next AV competition?',
        'Resolves YES if CMU''s Tartan Racing team places 1st in their next autonomous vehicle competition.',
        '00000000-0000-0000-0000-000000000003',
        '2026-04-05 23:59:00+00',
        'open',
        'Based on official competition results.',
        'Sports & Clubs',
        2000, 1800
    ),
    (
        '10000000-0000-0000-0000-000000000006',
        'Will the Fence be painted more than 3 times this week?',
        'Resolves YES if the Fence on campus is repainted more than 3 times in the current week.',
        '00000000-0000-0000-0000-000000000001',
        '2026-03-23 23:59:00+00',
        'closed',
        'Community photo log or campus newspaper report.',
        'Campus Life',
        600, 400
    )
ON CONFLICT (id) DO NOTHING;

-- Sample bets (Aaron on several markets)
INSERT INTO bets (user_id, market_id, side, amount) VALUES
    ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'YES', 200),
    ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 'YES', 150),
    ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004', 'NO',  100),
    ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000006', 'YES',  50);

-- Matching transactions
INSERT INTO transactions (user_id, market_id, transaction_type, amount) VALUES
    ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'bet_placement', -200),
    ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 'bet_placement', -150),
    ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004', 'bet_placement', -100),
    ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000006', 'bet_placement',  -50);

-- Update Aaron's balance to reflect bets placed (1000 - 200 - 150 - 100 - 50 = 500)
UPDATE profiles SET banana_balance = 500
WHERE id = '00000000-0000-0000-0000-000000000001';

# Seed plan v2: Silicon Valley users + real CMU markets

**Status:** awaiting review — **nothing has been written to the DB yet**.

Rewritten after hitting the web for real CMU news. Grounded in actual events from March/April 2026.

---

## Changes from v1

1. **Different balances** per user (250 → 15000 range) so the leaderboard has texture.
2. **Dropped the CMU-basketball-vs-Pitt market** (CMU doesn't have a high-profile basketball program; that was a bad assumption).
3. **Carnival framing fixed** — Spring Carnival 2026 ran **April 9–11**, so today (April 13) it already happened. Those markets are now **resolved**, not open.
4. **Real news baked in**:
   - Fetty Wap + Rebecca Black performed at Carnival on April 11 ([Tartan](https://the-tartan.org/2026/03/16/artists-fetty-wap-and-rebecca-black-to-perform-at-spring-carnival/))
   - CMU SCS tied MIT/Stanford for **#1 in the 2026 USNews Graduate CS rankings** ([CMU News](https://www.cmu.edu/news/stories/archives/2026/april/cmu-ranks-no-1-in-2026-us-news-graduate-rankings))
   - **Deep Tech Venture-Ready Program** launched, $240M in soft-circled capital ([CMU News](https://www.cmu.edu/news/stories/archives/2026/april/carnegie-mellon-university-launches-deep-tech-venture-ready-program-to-speed-breakthrough-science-to))
   - **AI Astronomy initiative** with the Simons Foundation ([AIwire](https://www.hpcwire.com/aiwire/2026/04/06/carnegie-mellon-launches-new-effort-to-advance-ai-driven-astronomy/))
   - **NFL Draft Week showcase** — "Powering the Future of Sport" ([CMU News](https://www.cmu.edu/news/stories/archives/2026/april/carnegie-mellon-university-and-ai-strike-team-to-showcase-the-future-of-physical-ai-during-nfl-draft))
   - **"Balsa"** — a wooden buggy raced in exhibition at 2026 Sweepstakes ([CMU News](https://www.cmu.edu/news/stories/archives/2026/april/knock-on-wood-a-different-spin-on-carnegie-mellons-buggy-race))
5. **Finals markets added** — Spring 2026 finals run **April 27 – May 1** per the [HUB Academic Calendar](https://www.cmu.edu/hub/calendar/2526-google.html). We're 2 weeks out, so finals-week questions are open.

---

## Users (8) — different balances + real character portraits

All Silicon Valley (HBO) characters. CMU-realistic Andrew IDs. **Avatars pulled from the Silicon Valley Fandom wiki CDN** (all URLs verified 200). Balances set via direct UPDATE after the 1000-banana initial grant.

| Andrew ID | Display name | Balance | Avatar (fandom wiki) |
|---|---|---:|---|
| `rhendrix` | Richard Hendricks | **4,200** | https://static.wikia.nocookie.net/silicon-valley/images/3/33/Richard_Hendricks.jpg |
| `ebachman` | Erlich Bachman | **12,000** | https://static.wikia.nocookie.net/silicon-valley/images/1/1f/Erlich_Bachman.jpg |
| `bgilfoyl` | Bertram Gilfoyle | **8,500** | https://static.wikia.nocookie.net/silicon-valley/images/2/20/Bertram_Gilfoyle.jpg |
| `dchughta` | Dinesh Chugtai | **2,800** | https://static.wikia.nocookie.net/silicon-valley/images/e/e3/Dinesh_Chugtai.jpg |
| `jdunn` | Jared Dunn | **6,400** | https://static.wikia.nocookie.net/silicon-valley/images/8/8f/Jared-dunn.png |
| `mhall` | Monica Hall | **11,200** | https://static.wikia.nocookie.net/silicon-valley/images/c/c8/Monica.png |
| `gbelson` | Gavin Belson | **15,000** | https://static.wikia.nocookie.net/silicon-valley/images/d/d5/Barcode.jpg |
| `nbighett` | Nelson "Big Head" Bighetti | **420** | https://static.wikia.nocookie.net/silicon-valley/images/b/b2/Silicon-Valley-Wikia_Josh-Brener_01.jpg |

(Big Head at 420 is a joke — character can't keep a balance alive. Gavin's image is his iconic "Barcode" promo shot from the wiki.)

---

## Markets (22)

Grounded in real 2026 events. Today is 2026-04-13. Mix of statuses reflects that Carnival *just* happened and finals are approaching.

### Resolved (8) — grounded in real news

| # | Title | Creator | Category | created_at | close_at | resolved_at | outcome |
|---|---|---|---|---|---|---|---|
| 1 | Will Fetty Wap headline Spring Carnival 2026? | rhendrix | Campus Life | 2025-11-10 | 2026-04-11 | 2026-04-12 | **YES** |
| 2 | Will Rebecca Black perform at Spring Carnival 2026? | jdunn | Campus Life | 2026-02-20 | 2026-04-11 | 2026-04-12 | **YES** |
| 3 | Will CMU SCS tie for #1 in 2026 USNews Graduate CS rankings? | mhall | Academics | 2026-02-01 | 2026-04-03 | 2026-04-04 | **YES** |
| 4 | Will CMU launch a Deep Tech Venture-Ready Program by end of Q2 2026? | gbelson | Tech | 2026-01-15 | 2026-04-05 | 2026-04-06 | **YES** |
| 5 | Will a wooden buggy named "Balsa" race in the 2026 Sweepstakes exhibition? | nbighett | Sports & Clubs | 2026-03-01 | 2026-04-11 | 2026-04-12 | **YES** |
| 6 | Will Spring Carnival 2026 run Thursday–Saturday (Apr 9–11)? | ebachman | Campus Life | 2026-01-20 | 2026-04-11 | 2026-04-12 | **YES** |
| 7 | Will it snow on the first day of Spring 2026 classes? | bgilfoyl | General | 2025-12-20 | 2026-01-13 | 2026-01-14 | **YES** |
| 8 | Will CMU's 2025–2026 graduating class exceed the previous year's? | dchughta | Academics | 2025-10-01 | 2026-03-15 | 2026-03-20 | **NO** |

### Open (8) — finals + upcoming events

| # | Title | Creator | Category | created_at | close_at |
|---|---|---|---|---|---|
| 9 | Will Hunt Library extend to 24/7 hours for Spring 2026 reading week? | jdunn | Campus Life | 2026-04-08 | 2026-04-26 |
| 10 | Will Sorrells Engineering Library hit 95%+ capacity during Spring 2026 finals? | bgilfoyl | Campus Life | 2026-04-12 | 2026-05-02 |
| 11 | Will the 15-251 final exam median fall below B– this spring? | rhendrix | Academics | 2026-04-10 | 2026-05-10 |
| 12 | Will Gates Hillman elevators break at least once during finals week? | dchughta | Campus Life | 2026-04-11 | 2026-05-03 |
| 13 | Will the Deep Tech Venture-Ready Program announce its first cohort by end of May? | gbelson | Tech | 2026-04-05 | 2026-05-31 |
| 14 | Will the CMU AI Astronomy initiative publish a paper before Fall 2026 semester? | mhall | Tech | 2026-04-06 | 2026-08-25 |
| 15 | Will CMU appear in 2+ mainstream news stories during NFL Draft Week? | ebachman | General | 2026-04-10 | 2026-04-27 |
| 16 | Will 2026–2027 CMU tuition be announced before commencement? | gbelson | Academics | 2026-04-08 | 2026-05-17 |

### Pending resolution (2)

| # | Title | Creator | Category | created_at | close_at | proposed_at | proposed |
|---|---|---|---|---|---|---|---|
| 17 | Will an SDC team win 2026 Men's Sweepstakes? | bgilfoyl | Sports & Clubs | 2026-01-20 | 2026-04-11 | 2026-04-12 | YES |
| 18 | Will a CIA team win 2026 Women's Sweepstakes? | mhall | Sports & Clubs | 2026-01-25 | 2026-04-11 | 2026-04-12 | YES |

### Disputed (1)

| # | Title | Creator | Category | created_at | close_at | proposed | disputed_at |
|---|---|---|---|---|---|---|---|
| 19 | Will 15-122 waitlist fully clear by week 2 of Fall 2026 registration? | rhendrix | Academics | 2026-02-01 | 2026-03-20 | NO | 2026-03-22 |

### Closed (awaiting resolution) (1)

| # | Title | Creator | Category | created_at | close_at |
|---|---|---|---|---|---|
| 20 | Will the Kiltie Band perform at all three Carnival days? | nbighett | Sports & Clubs | 2026-02-15 | 2026-04-11 |

### Pending review (2)

| # | Title | Creator | Category | created_at | close_at |
|---|---|---|---|---|---|
| 21 | Will CMU send a featured speaker to NeurIPS 2026? | dchughta | Tech | 2026-04-12 | 2026-12-10 |
| 22 | Will Carnival 2027 book a K-pop artist as headliner? | ebachman | Campus Life | 2026-04-13 | 2027-04-10 |

---

## Pool totals

Pre-set for display weight without fake bets. Resolved markets skew toward the winning side; open/disputed have closer splits.

| Status | `yes_pool_total` range | `no_pool_total` range |
|---|---|---|
| resolved YES | 500–1200 | 100–400 |
| resolved NO | 100–400 | 500–1200 |
| open | 80–600 | 80–600 |
| pending_resolution | 200–700 | 100–500 |
| disputed | 300–500 | 200–400 |
| closed | 150–500 | 150–500 |
| pending_review | 0 | 0 |

Concrete numbers are in the SQL below.

---

## SQL that will run (one transaction)

```sql
BEGIN;

-- 1. auth.users → trigger auto-creates profiles + 1000 initial_grant
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data
)
VALUES
  ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
   'rhendrix@andrew.cmu.edu', crypt(gen_random_uuid()::text, gen_salt('bf')),
   now(), now(), now(),
   '{"provider":"email","providers":["email"]}'::jsonb,
   '{"andrew_id":"rhendrix","full_name":"Richard Hendricks"}'::jsonb),
  -- ... 7 more rows
  ;

-- 2. Attach avatars + set varied balances in one pass
UPDATE profiles SET avatar_url = 'https://static.wikia.nocookie.net/silicon-valley/images/3/33/Richard_Hendricks.jpg',            banana_balance = 4200  WHERE andrew_id = 'rhendrix';
UPDATE profiles SET avatar_url = 'https://static.wikia.nocookie.net/silicon-valley/images/1/1f/Erlich_Bachman.jpg',                banana_balance = 12000 WHERE andrew_id = 'ebachman';
UPDATE profiles SET avatar_url = 'https://static.wikia.nocookie.net/silicon-valley/images/2/20/Bertram_Gilfoyle.jpg',              banana_balance = 8500  WHERE andrew_id = 'bgilfoyl';
UPDATE profiles SET avatar_url = 'https://static.wikia.nocookie.net/silicon-valley/images/e/e3/Dinesh_Chugtai.jpg',                banana_balance = 2800  WHERE andrew_id = 'dchughta';
UPDATE profiles SET avatar_url = 'https://static.wikia.nocookie.net/silicon-valley/images/8/8f/Jared-dunn.png',                    banana_balance = 6400  WHERE andrew_id = 'jdunn';
UPDATE profiles SET avatar_url = 'https://static.wikia.nocookie.net/silicon-valley/images/c/c8/Monica.png',                        banana_balance = 11200 WHERE andrew_id = 'mhall';
UPDATE profiles SET avatar_url = 'https://static.wikia.nocookie.net/silicon-valley/images/d/d5/Barcode.jpg',                       banana_balance = 15000 WHERE andrew_id = 'gbelson';
UPDATE profiles SET avatar_url = 'https://static.wikia.nocookie.net/silicon-valley/images/b/b2/Silicon-Valley-Wikia_Josh-Brener_01.jpg', banana_balance = 420 WHERE andrew_id = 'nbighett';

-- 3. Markets — 22 rows via CTE + andrew_id lookup
WITH seed(title, creator, category, description, resolution_criteria, status,
          created_at, close_at,
          proposed_outcome, proposed_at, disputed_at,
          resolved_outcome, resolved_at,
          yes_pool, no_pool) AS (
  VALUES
    -- RESOLVED (8)
    ('Will Fetty Wap headline Spring Carnival 2026?', 'rhendrix', 'Campus Life',
     'AB books a headliner each spring. Fetty Wap was announced in March.',
     'Resolves YES if Fetty Wap performed at the Saturday main-stage concert.',
     'resolved', '2025-11-10'::timestamptz, '2026-04-11'::timestamptz,
     NULL, NULL, NULL, 'YES', '2026-04-12'::timestamptz, 980, 220),

    ('Will Rebecca Black perform at Spring Carnival 2026?', 'jdunn', 'Campus Life',
     'Announced as a supporting act alongside Fetty Wap.',
     'Resolves YES if Rebecca Black performed during Carnival.',
     'resolved', '2026-02-20'::timestamptz, '2026-04-11'::timestamptz,
     NULL, NULL, NULL, 'YES', '2026-04-12'::timestamptz, 720, 180),

    ('Will CMU SCS tie for #1 in 2026 USNews Graduate CS rankings?', 'mhall', 'Academics',
     'USNews releases graduate rankings each spring.',
     'Resolves YES if CMU is listed in a tie for #1 in the 2026 CS rankings.',
     'resolved', '2026-02-01'::timestamptz, '2026-04-03'::timestamptz,
     NULL, NULL, NULL, 'YES', '2026-04-04'::timestamptz, 1150, 150),

    ('Will CMU launch a Deep Tech Venture-Ready Program by end of Q2 2026?', 'gbelson', 'Tech',
     'Swartz Center rumored a new cohort-based accelerator.',
     'Resolves YES if CMU officially launches a Deep Tech Venture-Ready Program by 2026-06-30.',
     'resolved', '2026-01-15'::timestamptz, '2026-04-05'::timestamptz,
     NULL, NULL, NULL, 'YES', '2026-04-06'::timestamptz, 640, 260),

    ('Will a wooden buggy named "Balsa" race in the 2026 Sweepstakes exhibition?', 'nbighett', 'Sports & Clubs',
     'A senior ME student announced an exhibition entry.',
     'Resolves YES if "Balsa" ran on the course during Carnival weekend.',
     'resolved', '2026-03-01'::timestamptz, '2026-04-11'::timestamptz,
     NULL, NULL, NULL, 'YES', '2026-04-12'::timestamptz, 510, 190),

    ('Will Spring Carnival 2026 run Thursday–Saturday (Apr 9–11)?', 'ebachman', 'Campus Life',
     'AB posted the official dates in January.',
     'Resolves YES if Carnival events took place across April 9, 10, and 11.',
     'resolved', '2026-01-20'::timestamptz, '2026-04-11'::timestamptz,
     NULL, NULL, NULL, 'YES', '2026-04-12'::timestamptz, 1100, 120),

    ('Will it snow on the first day of Spring 2026 classes?', 'bgilfoyl', 'General',
     'Pittsburgh weather, always a gamble.',
     'Resolves YES if measurable snowfall was recorded in the city on 2026-01-13.',
     'resolved', '2025-12-20'::timestamptz, '2026-01-13'::timestamptz,
     NULL, NULL, NULL, 'YES', '2026-01-14'::timestamptz, 660, 300),

    ('Will CMU''s 2025–2026 graduating class exceed the previous year''s?', 'dchughta', 'Academics',
     'Commencement enrollment numbers released each March.',
     'Resolves YES if the 2026 graduating class is larger than 2025.',
     'resolved', '2025-10-01'::timestamptz, '2026-03-15'::timestamptz,
     NULL, NULL, NULL, 'NO', '2026-03-20'::timestamptz, 230, 680),

    -- OPEN (8) — finals + upcoming
    ('Will Hunt Library extend to 24/7 hours for Spring 2026 reading week?', 'jdunn', 'Campus Life',
     'Hunt has gone 24/7 the past two years. Will they do it again?',
     'Resolves YES if the CMU Libraries announce 24/7 operating hours during reading week.',
     'open', '2026-04-08'::timestamptz, '2026-04-26'::timestamptz,
     NULL, NULL, NULL, NULL, NULL, 320, 180),

    ('Will Sorrells Engineering Library hit 95%+ capacity during Spring 2026 finals?', 'bgilfoyl', 'Campus Life',
     'Sorrells tends to fill up fast.',
     'Resolves YES if any day during finals week records 95%+ occupancy.',
     'open', '2026-04-12'::timestamptz, '2026-05-02'::timestamptz,
     NULL, NULL, NULL, NULL, NULL, 420, 120),

    ('Will the 15-251 final exam median fall below B– this spring?', 'rhendrix', 'Academics',
     'Classic CMU weeder.',
     'Resolves YES if the official course median for the final exam is below 80%.',
     'open', '2026-04-10'::timestamptz, '2026-05-10'::timestamptz,
     NULL, NULL, NULL, NULL, NULL, 560, 260),

    ('Will Gates Hillman elevators break at least once during finals week?', 'dchughta', 'Campus Life',
     'Has happened every semester for the past 3 years.',
     'Resolves YES if any elevator is reported out of service during April 27–May 1.',
     'open', '2026-04-11'::timestamptz, '2026-05-03'::timestamptz,
     NULL, NULL, NULL, NULL, NULL, 540, 90),

    ('Will the Deep Tech Venture-Ready Program announce its first cohort by end of May?', 'gbelson', 'Tech',
     'Program just launched in early April.',
     'Resolves YES if Swartz announces selected cohort companies before 2026-06-01.',
     'open', '2026-04-05'::timestamptz, '2026-05-31'::timestamptz,
     NULL, NULL, NULL, NULL, NULL, 300, 200),

    ('Will the CMU AI Astronomy initiative publish a paper before Fall 2026 semester?', 'mhall', 'Tech',
     'Funded by Simons Foundation; first paper would be a good signal.',
     'Resolves YES if any paper with a CMU AI-astronomy co-author is posted to arXiv by 2026-08-25.',
     'open', '2026-04-06'::timestamptz, '2026-08-25'::timestamptz,
     NULL, NULL, NULL, NULL, NULL, 180, 220),

    ('Will CMU appear in 2+ mainstream news stories during NFL Draft Week?', 'ebachman', 'General',
     'Draft Week showcase "Powering the Future of Sport" is CMU-hosted.',
     'Resolves YES if 2+ non-CMU-owned outlets (ESPN, WSJ, NYT, etc.) publish during Draft Week.',
     'open', '2026-04-10'::timestamptz, '2026-04-27'::timestamptz,
     NULL, NULL, NULL, NULL, NULL, 250, 150),

    ('Will 2026–2027 CMU tuition be announced before commencement?', 'gbelson', 'Academics',
     'Typically announced in May.',
     'Resolves YES if the Registrar publishes 2026–2027 tuition rates before 2026-05-17.',
     'open', '2026-04-08'::timestamptz, '2026-05-17'::timestamptz,
     NULL, NULL, NULL, NULL, NULL, 430, 110),

    -- PENDING RESOLUTION (2)
    ('Will an SDC team win 2026 Men''s Sweepstakes?', 'bgilfoyl', 'Sports & Clubs',
     'SDC has dominated the men''s bracket for years.',
     'Resolves YES if an SDC team places 1st in the 2026 Men''s Sweepstakes final.',
     'pending_resolution', '2026-01-20'::timestamptz, '2026-04-11'::timestamptz,
     'YES', '2026-04-12'::timestamptz, NULL, NULL, NULL, 680, 220),

    ('Will a CIA team win 2026 Women''s Sweepstakes?', 'mhall', 'Sports & Clubs',
     'CIA has been the dominant women''s team recently.',
     'Resolves YES if a CIA team places 1st in the 2026 Women''s Sweepstakes final.',
     'pending_resolution', '2026-01-25'::timestamptz, '2026-04-11'::timestamptz,
     'YES', '2026-04-12'::timestamptz, NULL, NULL, NULL, 520, 300),

    -- DISPUTED (1)
    ('Will 15-122 waitlist fully clear by week 2 of Fall 2026 registration?', 'rhendrix', 'Academics',
     'Famously oversubscribed intro course.',
     'Resolves YES if the official waitlist reaches zero during the first two weeks.',
     'disputed', '2026-02-01'::timestamptz, '2026-03-20'::timestamptz,
     'NO', '2026-03-21'::timestamptz, '2026-03-22'::timestamptz, NULL, NULL, 360, 340),

    -- CLOSED awaiting (1)
    ('Will the Kiltie Band perform at all three Carnival days?', 'nbighett', 'Sports & Clubs',
     'Kilties historically show up for at least two days.',
     'Resolves YES if confirmed sightings exist for all three Carnival days.',
     'closed', '2026-02-15'::timestamptz, '2026-04-11'::timestamptz,
     NULL, NULL, NULL, NULL, NULL, 280, 220),

    -- PENDING REVIEW (2)
    ('Will CMU send a featured speaker to NeurIPS 2026?', 'dchughta', 'Tech',
     'NeurIPS 2026 program is announced in late summer.',
     'Resolves YES if a CMU-affiliated speaker is listed in the NeurIPS 2026 keynote lineup.',
     'pending_review', '2026-04-12'::timestamptz, '2026-12-10'::timestamptz,
     NULL, NULL, NULL, NULL, NULL, 0, 0),

    ('Will Carnival 2027 book a K-pop artist as headliner?', 'ebachman', 'Campus Life',
     'Long-shot wishlist item.',
     'Resolves YES if AB announces a K-pop artist as the 2027 headliner.',
     'pending_review', '2026-04-13'::timestamptz, '2027-04-10'::timestamptz,
     NULL, NULL, NULL, NULL, NULL, 0, 0)
)
INSERT INTO markets (
  id, title, description, creator_id, created_at, close_at, status,
  resolution_criteria, category, yes_pool_total, no_pool_total, market_type,
  proposed_outcome, proposed_at, disputed_at, resolved_outcome, resolved_at
)
SELECT
  gen_random_uuid(), s.title, s.description, p.id, s.created_at, s.close_at, s.status,
  s.resolution_criteria, s.category, COALESCE(s.yes_pool, 0), COALESCE(s.no_pool, 0), 'binary',
  s.proposed_outcome, s.proposed_at, s.disputed_at, s.resolved_outcome, s.resolved_at
FROM seed s
JOIN profiles p ON p.andrew_id = s.creator;

COMMIT;
```

---

## Rollback (saved for later)

```sql
DELETE FROM auth.users WHERE email IN (
  'rhendrix@andrew.cmu.edu','ebachman@andrew.cmu.edu','bgilfoyl@andrew.cmu.edu',
  'dchughta@andrew.cmu.edu','jdunn@andrew.cmu.edu','mhall@andrew.cmu.edu',
  'gbelson@andrew.cmu.edu','nbighett@andrew.cmu.edu'
);
-- then manually drop any markets still referencing these creators:
-- (run the market-cleanup helper we used for the smoke-test cleanup earlier)
```

---

## Review checklist

- [ ] Balances OK (Big Head at 420 is a joke; Gavin at 15k is top)?
- [ ] Avatar URLs OK?
- [ ] Markets 1–8 resolved with correct outcomes per the real news I found?
- [ ] Market 17/18 — want me to pick an actual winner (searchable but I couldn't find 2026 specifically) rather than leaving it pending_resolution with a proposal?
- [ ] Market 19 disputed setup reasonable?
- [ ] Any topic you want me to add or drop?

Reply with tweaks or "go" and I'll run it.

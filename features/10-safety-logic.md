# Feature 10: Safety Logic & Admin Backroll

**Phase:** 2 (depends on Phase 1)
**Dependencies:** `01-admin-system` (admin roles for backroll permissions)
**Parallelizable with:** `02-market-creation-review`, `04-market-resolution`

---

## Summary

Enforce critical safety contracts across the platform: prevent bets after market close, **prevent creators from betting or community-voting on their own markets**, prevent market editing after submission for review, handle concurrent bets safely, and add an admin backroll mechanism for markets with ambiguous timelines.

---

## Current State

- The `place_bet` SQL function already checks `market.status != 'open'` and uses `FOR UPDATE` locks, providing basic safety.
- The `close_expired_markets` function closes markets whose `close_at` has passed.
- Lazy transitions in `_apply_lazy_transitions` also catch expired markets.
- No explicit protection against editing markets after submission.
- No backroll mechanism exists.
- Concurrent bets are handled by PostgreSQL row-level locks (`FOR UPDATE`) in `place_bet`.

---

## Safety Contract 1: No Bets After Market Close

### Current Implementation (Already Exists)

The `place_bet` function checks:
```sql
IF v_market_status != 'open' THEN
    RAISE EXCEPTION 'Market is not open for betting';
END IF;
```

And locks the market row with `FOR UPDATE` to prevent race conditions.

### Gaps to Address

1. **Lazy close timing:** A market's `close_at` may have passed but the status hasn't been updated yet (it's still `'open'` in the DB until someone fetches it). The `place_bet` function checks `status`, not `close_at`.

**Fix:** Add an explicit `close_at` check in the `place_bet` function:

### Migration 047: Harden Place Bet Function

**File:** `backend/supabase/migrations/047_harden_place_bet.sql`

```sql
CREATE OR REPLACE FUNCTION place_bet(
    p_user_id   UUID,
    p_market_id UUID,
    p_side      TEXT,
    p_amount    NUMERIC
) RETURNS JSONB AS $$
DECLARE
    v_balance       NUMERIC;
    v_market_status TEXT;
    v_close_at      TIMESTAMPTZ;
    v_bet_id        UUID;
BEGIN
    IF p_side NOT IN ('YES', 'NO') THEN
        RAISE EXCEPTION 'Invalid side: must be YES or NO';
    END IF;
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Bet amount must be positive';
    END IF;

    SELECT banana_balance INTO v_balance
    FROM profiles WHERE id = p_user_id FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'User not found'; END IF;
    IF v_balance < p_amount THEN RAISE EXCEPTION 'Insufficient balance'; END IF;

    SELECT status, close_at INTO v_market_status, v_close_at
    FROM markets WHERE id = p_market_id FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Market not found'; END IF;

    -- Check both status AND close_at timestamp
    IF v_market_status != 'open' THEN
        RAISE EXCEPTION 'Market is not open for betting';
    END IF;

    IF v_close_at <= now() THEN
        -- Close the market right now (lazy close at bet time)
        UPDATE markets SET status = 'closed' WHERE id = p_market_id;
        RAISE EXCEPTION 'Market has closed';
    END IF;

    UPDATE profiles SET banana_balance = banana_balance - p_amount WHERE id = p_user_id;

    IF p_side = 'YES' THEN
        UPDATE markets SET yes_pool_total = yes_pool_total + p_amount WHERE id = p_market_id;
    ELSE
        UPDATE markets SET no_pool_total = no_pool_total + p_amount WHERE id = p_market_id;
    END IF;

    INSERT INTO bets (user_id, market_id, side, amount)
    VALUES (p_user_id, p_market_id, p_side, p_amount)
    RETURNING id INTO v_bet_id;

    INSERT INTO transactions (user_id, market_id, transaction_type, amount)
    VALUES (p_user_id, p_market_id, 'bet_placement', -p_amount);

    RETURN jsonb_build_object(
        'bet_id', v_bet_id,
        'new_balance', v_balance - p_amount
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

Similarly update `place_multichoice_bet` (from Feature 03) to include the `close_at` check.

---

## Safety Contract 2: Creator Cannot Bet on Own Market

### Rule

A market creator is **prohibited from placing bets** on any market they created. The creator already has unique power over the market (proposing resolution outcomes), so allowing them to also bet would create a conflict of interest. However, the creator **can** propose a resolution outcome — that is their designated role in Track A of the dual resolution system.

### Implementation

Add a creator check to the `place_bet` SQL function:

**Modify Migration 047 (`047_harden_place_bet.sql`)** to include:

```sql
-- After locking the market row and checking status:
DECLARE
    v_creator_id UUID;
BEGIN
    -- ...existing declarations and checks...

    SELECT status, close_at, creator_id INTO v_market_status, v_close_at, v_creator_id
    FROM markets WHERE id = p_market_id FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Market not found'; END IF;

    -- Creator cannot bet on their own market
    IF p_user_id = v_creator_id THEN
        RAISE EXCEPTION 'Market creators cannot place bets on their own markets';
    END IF;

    -- ...rest of existing checks (status, close_at, etc.)...
```

Similarly update `place_multichoice_bet` (from Feature 03) with the same creator check.

### Backend Endpoint Handling

In `backend/routers/bets.py`, catch the new exception message:

```python
except Exception as e:
    msg = str(e).lower()
    if "creators cannot place bets" in msg:
        raise HTTPException(403, "You cannot bet on a market you created.")
    # ...existing error handling...
```

### Frontend Enforcement

On the market detail page (`app/markets/[id]/page.tsx`):

- If the current user is the market creator, **disable the bet input and buttons** entirely.
- Show an explanatory message in place of the bet form: "As the market creator, you cannot place bets on this market. You will be able to propose a resolution once the market closes."
- The market info (probability chart, pool totals, positions) should still be fully visible to the creator.

---

## Safety Contract 3: No Market Editing After Submission

### Rule

A user cannot edit or delete their market after its status becomes `pending_review` or after the market is approved (any status other than a draft state).

### Implementation

Since markets are currently created directly into `pending_review` status (per Feature 02), there is no "draft" state. Once a market is submitted, it's immutable by the creator.

**Backend enforcement:**

The existing RLS policy allows creators to update their own markets:
```sql
CREATE POLICY "Creators can update own markets"
    ON markets FOR UPDATE USING (auth.uid() = creator_id);
```

This is too permissive. Replace it:

### Migration 048: Restrict Market Updates

**File:** `backend/supabase/migrations/048_restrict_market_updates.sql`

```sql
-- Drop the overly permissive creator update policy
DROP POLICY IF EXISTS "Creators can update own markets" ON markets;

-- Creators can NEVER update markets after creation
-- (Market fields are only editable by admins during review)
-- This is intentionally restrictive — no user role can edit after approval

-- Admins can update markets (for review process and resolution)
-- This policy was created in Feature 01 (022_admin_rls_policies.sql)
-- If not already present, create it:
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'markets'
        AND policyname = 'Admins can update any market'
    ) THEN
        CREATE POLICY "Admins can update any market"
            ON markets FOR UPDATE
            USING (
                EXISTS (
                    SELECT 1 FROM profiles
                    WHERE profiles.id = auth.uid()
                    AND profiles.role IN ('admin', 'super_admin')
                )
            );
    END IF;
END $$;

-- No user role can delete markets after approval
-- Markets should never be deleted — they are audit trail
-- (No DELETE policies are granted, which is the Supabase default with RLS enabled)

-- Also ensure no one can update a market that is already resolved
CREATE OR REPLACE FUNCTION prevent_resolved_market_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF OLD.status = 'resolved' AND NEW.status = 'resolved' THEN
        -- Allow internal updates only if they don't change key fields
        IF NEW.title != OLD.title OR NEW.description != OLD.description
           OR NEW.resolution_criteria != OLD.resolution_criteria THEN
            RAISE EXCEPTION 'Cannot modify a resolved market';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_resolved_market ON markets;
CREATE TRIGGER guard_resolved_market
    BEFORE UPDATE ON markets
    FOR EACH ROW EXECUTE FUNCTION prevent_resolved_market_update();
```

**Frontend enforcement:**

In the market detail page, do NOT show any edit/delete buttons regardless of whether the user is the creator. The market creation form is a one-shot submit.

---

## Safety Contract 4: Concurrent Bet Handling

### Current State

Already well-handled by PostgreSQL:
- `place_bet` uses `FOR UPDATE` on both the profile and market rows.
- This serializes concurrent bets on the same market or by the same user.
- The `idx_unique_daily_claim` index prevents double daily claims.

### Verification

Ensure the following are true (they already should be):
1. `place_bet` acquires `FOR UPDATE` lock on `profiles` row (prevents same user from double-spending).
2. `place_bet` acquires `FOR UPDATE` lock on `markets` row (prevents pool total corruption).
3. Both locks are held within the same function transaction, ensuring atomicity.

**No additional changes needed** — PostgreSQL's MVCC and `FOR UPDATE` locks handle this correctly. Document this in the codebase:

Add a comment in `002_place_bet_function.sql` (or the updated version):
```sql
-- Concurrency note: FOR UPDATE locks on both profiles and markets rows
-- ensure that concurrent bets by the same user or on the same market
-- are serialized. PostgreSQL guarantees no lost updates or dirty reads.
```

---

## Safety Contract 5: Admin Backroll for Ambiguous Timelines

### Problem

A market might have an ambiguous end date (e.g., "Will X happen by summer?"). If the actual event occurs before the market's `close_at` date, bets placed between the event and the market close are unfair — the outcome was already known.

### Solution

Allow admins to **backroll** a market: specify a "true close date" that is earlier than the original `close_at`, and cancel all bets placed after that true close date. Refund those bettors.

### Database Changes

#### Migration 049: Backroll Function

**File:** `backend/supabase/migrations/049_fn_admin_backroll.sql`

```sql
-- Admin backroll: cancel bets placed after a given cutoff date
-- and refund those bettors. Adjust pool totals accordingly.
CREATE OR REPLACE FUNCTION admin_backroll_market(
    p_market_id   UUID,
    p_admin_id    UUID,
    p_cutoff_date TIMESTAMPTZ,
    p_close_market BOOLEAN DEFAULT TRUE
) RETURNS JSONB AS $$
DECLARE
    v_is_admin BOOLEAN;
    v_status TEXT;
    v_bet RECORD;
    v_total_refunded NUMERIC := 0;
    v_bets_cancelled INTEGER := 0;
    v_yes_refund NUMERIC := 0;
    v_no_refund NUMERIC := 0;
BEGIN
    -- Verify admin
    SELECT (role IN ('admin', 'super_admin')) INTO v_is_admin
    FROM profiles WHERE id = p_admin_id;

    IF v_is_admin IS NOT TRUE THEN
        RAISE EXCEPTION 'Only admins can perform backroll';
    END IF;

    -- Lock market
    SELECT status INTO v_status FROM markets WHERE id = p_market_id FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Market not found'; END IF;

    -- Market should not be resolved yet for backroll to make sense
    IF v_status = 'resolved' THEN
        RAISE EXCEPTION 'Cannot backroll a resolved market. Resolve must happen after backroll.';
    END IF;

    -- Find and refund bets placed after the cutoff
    FOR v_bet IN
        SELECT id, user_id, side, amount
        FROM bets
        WHERE market_id = p_market_id
          AND created_at > p_cutoff_date
        ORDER BY created_at DESC
    LOOP
        -- Refund the user
        UPDATE profiles SET banana_balance = banana_balance + v_bet.amount
        WHERE id = v_bet.user_id;

        -- Record refund transaction
        INSERT INTO transactions (user_id, market_id, transaction_type, amount)
        VALUES (v_bet.user_id, p_market_id, 'payout', v_bet.amount);

        -- Track pool adjustments
        IF v_bet.side = 'YES' THEN
            v_yes_refund := v_yes_refund + v_bet.amount;
        ELSE
            v_no_refund := v_no_refund + v_bet.amount;
        END IF;

        v_total_refunded := v_total_refunded + v_bet.amount;
        v_bets_cancelled := v_bets_cancelled + 1;

        -- Delete the bet (it's as if it never happened)
        DELETE FROM bets WHERE id = v_bet.id;
    END LOOP;

    -- Adjust pool totals
    UPDATE markets SET
        yes_pool_total = GREATEST(0, yes_pool_total - v_yes_refund),
        no_pool_total = GREATEST(0, no_pool_total - v_no_refund)
    WHERE id = p_market_id;

    -- Optionally close the market with the cutoff as the true close time
    IF p_close_market THEN
        UPDATE markets SET
            status = 'closed',
            close_at = p_cutoff_date
        WHERE id = p_market_id;
    END IF;

    RETURN jsonb_build_object(
        'market_id', p_market_id,
        'bets_cancelled', v_bets_cancelled,
        'total_refunded', v_total_refunded,
        'new_close_at', p_cutoff_date,
        'status', CASE WHEN p_close_market THEN 'closed' ELSE v_status END
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Backend Endpoint

Add to `backend/routers/admin.py`:

```python
@router.post("/api/admin/markets/{market_id}/backroll")
async def backroll_market(
    market_id: str,
    body: BackrollRequest,
    current_user: dict = Depends(require_admin),
    supabase: Client = Depends(get_supabase_client),
):
    """Admin backroll: cancel bets placed after a cutoff date and refund bettors."""
    try:
        result = supabase.rpc("admin_backroll_market", {
            "p_market_id": market_id,
            "p_admin_id": current_user["id"],
            "p_cutoff_date": body.cutoff_date.isoformat(),
            "p_close_market": body.close_market,
        }).execute()
        return result.data
    except Exception as e:
        msg = str(e).lower()
        if "not found" in msg:
            raise HTTPException(404, "Market not found.")
        if "resolved" in msg:
            raise HTTPException(400, "Cannot backroll a resolved market.")
        raise HTTPException(500, f"Backroll failed: {e}")
```

Add the request schema to `backend/schemas/admin.py`:

```python
class BackrollRequest(BaseModel):
    cutoff_date: datetime
    close_market: bool = True  # Whether to also close the market at the cutoff date
```

### Admin UI

In the admin review page or a dedicated admin market management area:

1. When viewing a market in admin review or disputed state, show a "Backroll" button.
2. On click, show a form with:
   - **Cutoff Date/Time** — datetime picker for when the true event resolution occurred
   - **Close Market** — checkbox (default: checked) — whether to also set the market's `close_at` to the cutoff date
   - **Warning text:** "This will cancel all bets placed after the specified date and refund those users. This action cannot be undone."
3. On submit, call `POST /api/admin/markets/{id}/backroll`.
4. Show a confirmation dialog with the number of bets that will be cancelled and the total refund amount.

### Workflow for Ambiguous Timeline Markets

**Recommended workflow** (to document in admin guidelines):

1. **During market creation:** The creator specifies a `close_at` date. If the timeline is ambiguous (e.g., "by summer"), they should set a generous `close_at` (e.g., end of summer).
2. **When the event actually resolves:** If it resolves before `close_at`, an admin (or the market's dispute process) flags it.
3. **Admin backroll:** The admin uses the backroll function to:
   - Set the true close date to when the event actually resolved.
   - Cancel all bets placed after that date.
   - Refund affected bettors.
4. **Then resolve:** After backroll, the market can proceed through normal resolution.

**Alternative approach considered:** Adding an "ambiguous end date" flag during market creation. This was considered but rejected in favor of the simpler backroll approach because:
- It keeps market creation simple.
- It handles any unforeseen timing issues, not just ones anticipated at creation.
- Admin backroll is a general-purpose tool usable for many edge cases.

---

## Additional Safety Measures

### Input Validation Hardening

Ensure all endpoints validate inputs thoroughly:

1. **Bet amounts:** Must be positive, must not exceed balance, must be a valid number (no NaN, no Infinity).
2. **Market creation:** Title length (max 200 chars), description length (max 2000 chars), category must be from allowed list.
3. **Dates:** `close_at` must be in the future. `cutoff_date` for backroll must be in the past and before the market's `close_at`.
4. **UUIDs:** All ID parameters should be validated as proper UUID format before querying.

### Rate Limiting Recommendations

While not implemented in this feature (would need a Redis/rate-limiting middleware), document that the following endpoints should be rate-limited in production:
- `POST /api/auth/claim-daily` — already naturally limited to 1/day
- `POST /api/markets/{id}/bets` — consider 10 bets per minute per user
- `POST /api/markets` — consider 5 market proposals per day per user
- `POST /api/markets/{id}/community-vote` — already limited to 1 per market

---

## Testing Checklist

- [ ] Cannot place a bet on a market whose `close_at` has passed (even if status is still `open`)
- [ ] `place_bet` function closes the market lazily if `close_at` has passed
- [ ] **Market creator cannot bet on their own market** (SQL function raises exception)
- [ ] **Market creator sees disabled bet form with explanatory message on frontend**
- [ ] **Market creator CAN still propose a resolution** (Track A is unaffected)
- [ ] Cannot edit a market after it's submitted for review (creator has no update permission)
- [ ] Admin can edit markets during review
- [ ] Cannot modify a resolved market's title/description
- [ ] Concurrent bets by the same user don't cause double-spending
- [ ] Concurrent bets on the same market don't corrupt pool totals
- [ ] Admin can backroll a market to a cutoff date
- [ ] Backroll cancels bets after cutoff and refunds users
- [ ] Backroll adjusts pool totals correctly
- [ ] Backroll can optionally close the market at the cutoff date
- [ ] Cannot backroll a resolved market
- [ ] Only admins can perform backroll
- [ ] Refund transactions appear in affected users' transaction histories

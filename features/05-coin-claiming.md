# Feature 05: Coin Claiming Rules Update

**Phase:** 1 (Foundation — no dependencies)
**Dependencies:** None
**Parallelizable with:** `01-admin-system`, `06-user-profile`

---

## Summary

Update the daily coin claiming logic so that users can only claim coins if their balance is below 5,000. If their balance is between 4,000 and 5,000, they claim only enough to reach 5,000 (not a full 1,000). Add transparency text explaining these rules. The cap applies to **coin balance only**, not active bets.

---

## Current State

- Users can claim 1,000 bananas daily via `POST /api/auth/claim-daily`.
- The `claim_daily_bananas` SQL function adds 1,000 unconditionally (if not already claimed today).
- The portfolio page shows a "Claim 1,000 Daily Bananas" button.
- No balance cap exists.
- Daily claim banner component exists at `frontend/src/components/daily-claim-banner.tsx`.

---

## Database Changes

### Migration 038: Update Claim Function with Cap

**File:** `backend/supabase/migrations/038_fn_claim_daily_capped.sql`

```sql
-- Replace the claim function with a capped version
CREATE OR REPLACE FUNCTION claim_daily_bananas(
    p_user_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_today   DATE;
    v_balance NUMERIC;
    v_claim_amount NUMERIC;
    v_cap NUMERIC := 5000;
BEGIN
    v_today := (now() AT TIME ZONE 'America/New_York')::date;

    SELECT banana_balance INTO v_balance FROM profiles WHERE id = p_user_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User not found';
    END IF;

    -- Check if already claimed today
    IF EXISTS (
        SELECT 1 FROM transactions
        WHERE user_id = p_user_id
          AND transaction_type = 'daily_claim'
          AND (created_at AT TIME ZONE 'America/New_York')::date = v_today
    ) THEN
        RAISE EXCEPTION 'Already claimed today';
    END IF;

    -- Check balance cap (based on coin balance, not active bets)
    IF v_balance >= v_cap THEN
        RAISE EXCEPTION 'Balance is at or above the daily claim cap of 5000';
    END IF;

    -- Calculate claim amount: min(1000, cap - balance)
    v_claim_amount := LEAST(1000, v_cap - v_balance);

    IF v_claim_amount <= 0 THEN
        RAISE EXCEPTION 'Balance is at or above the daily claim cap of 5000';
    END IF;

    UPDATE profiles SET banana_balance = banana_balance + v_claim_amount WHERE id = p_user_id;

    INSERT INTO transactions (user_id, transaction_type, amount)
    VALUES (p_user_id, 'daily_claim', v_claim_amount);

    RETURN jsonb_build_object(
        'new_balance', v_balance + v_claim_amount,
        'claimed_amount', v_claim_amount,
        'claimed_at', now()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Migration 039: Check Claim Eligibility Function

**File:** `backend/supabase/migrations/039_fn_check_claim_eligibility.sql`

```sql
-- Returns claim eligibility info for the UI
CREATE OR REPLACE FUNCTION check_claim_eligibility(
    p_user_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_today DATE;
    v_balance NUMERIC;
    v_claimed_today BOOLEAN;
    v_eligible BOOLEAN;
    v_claim_amount NUMERIC;
    v_cap NUMERIC := 5000;
BEGIN
    v_today := (now() AT TIME ZONE 'America/New_York')::date;

    SELECT banana_balance INTO v_balance FROM profiles WHERE id = p_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User not found';
    END IF;

    v_claimed_today := EXISTS (
        SELECT 1 FROM transactions
        WHERE user_id = p_user_id
          AND transaction_type = 'daily_claim'
          AND (created_at AT TIME ZONE 'America/New_York')::date = v_today
    );

    v_eligible := NOT v_claimed_today AND v_balance < v_cap;
    v_claim_amount := CASE
        WHEN NOT v_eligible THEN 0
        ELSE LEAST(1000, v_cap - v_balance)
    END;

    RETURN jsonb_build_object(
        'eligible', v_eligible,
        'claimed_today', v_claimed_today,
        'balance', v_balance,
        'claim_amount', v_claim_amount,
        'cap', v_cap,
        'above_cap', v_balance >= v_cap
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## Backend Changes

### Modify: `backend/routers/auth.py`

Update the `/me` endpoint to include claim eligibility:

```python
@router.get("/me", response_model=UserProfileResponse)
async def get_me(
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client),
):
    eligibility = supabase.rpc("check_claim_eligibility", {
        "p_user_id": current_user["id"]
    }).execute()

    claim_info = eligibility.data if eligibility.data else {}
    current_user["claimed_today"] = claim_info.get("claimed_today", False)
    current_user["claim_eligible"] = claim_info.get("eligible", False)
    current_user["claim_amount"] = claim_info.get("claim_amount", 0)
    current_user["above_cap"] = claim_info.get("above_cap", False)
    return current_user
```

Update the `/claim-daily` endpoint error handling:

```python
@router.post("/claim-daily", response_model=ClaimResponse)
async def claim_daily_bananas(
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client),
):
    try:
        result = supabase.rpc("claim_daily_bananas", {
            "p_user_id": current_user["id"],
        }).execute()
        return result.data
    except Exception as e:
        msg = str(e).lower()
        if "already claimed" in msg:
            raise HTTPException(status_code=409, detail="Already claimed today.")
        if "cap" in msg or "above" in msg:
            raise HTTPException(status_code=409, detail="Balance is at or above the 5,000 coin daily claim cap.")
        raise HTTPException(status_code=500, detail=f"Failed to claim: {e}")
```

### Modify: `backend/schemas/user.py`

```python
class UserProfileResponse(BaseModel):
    id: str
    andrew_id: str
    display_name: str
    banana_balance: float
    created_at: datetime
    claimed_today: bool = False
    role: str = "user"
    is_admin: bool = False
    claim_eligible: bool = True   # NEW
    claim_amount: float = 1000    # NEW
    above_cap: bool = False       # NEW
```

### Modify: `backend/schemas/dispute.py`

Update `ClaimResponse`:
```python
class ClaimResponse(BaseModel):
    new_balance: float
    claimed_amount: float = 1000  # NEW: actual amount claimed (may be < 1000)
    claimed_at: datetime
```

---

## Frontend Changes

### Update: `frontend/src/lib/types.ts`

```typescript
export interface UserProfile {
  // ... existing fields ...
  claim_eligible: boolean;   // NEW
  claim_amount: number;      // NEW: how many coins they can claim (0-1000)
  above_cap: boolean;        // NEW: whether balance >= 5000
}
```

### Update: `frontend/src/app/portfolio/page.tsx`

Replace the current claim section with logic that handles three states:

**State 1: Already claimed today**
```tsx
<p className="text-xs text-muted-foreground">
  Claimed! Come back tomorrow.
</p>
```

**State 2: Balance >= 5,000 (above cap)**
```tsx
<p className="text-xs text-muted-foreground">
  Daily claiming is available when your balance is below 5,000 coins.
  Your current balance ({user.banana_balance.toLocaleString()}) exceeds this threshold.
</p>
```

**State 3: Eligible to claim (balance < 5,000, not yet claimed)**
```tsx
<Button
  size="sm"
  className="w-full"
  onClick={handleClaim}
  disabled={claiming}
>
  {claiming ? (
    <Spinner />
  ) : user.claim_amount < 1000 ? (
    `Claim ${user.claim_amount.toLocaleString()} Daily Bananas`
  ) : (
    "Claim 1,000 Daily Bananas"
  )}
</Button>
<p className="text-xs text-muted-foreground mt-1">
  Daily coin claiming is available until your balance reaches 5,000 coins.
  {user.banana_balance > 4000 && user.banana_balance < 5000 && (
    <> You can claim {(5000 - user.banana_balance).toLocaleString()} more coins today.</>
  )}
</p>
```

### Update: `frontend/src/components/daily-claim-banner.tsx`

If this component shows a claim prompt:
- Only show it when `user.claim_eligible` is true.
- Update the claim amount text to use `user.claim_amount` instead of hardcoded 1000.

### Update: `frontend/src/lib/DataProvider.tsx`

Update the `claimDaily` function to use the actual claimed amount from the response instead of hardcoding 1000:

```typescript
const claimDaily = useCallback(async () => {
  const result = await api.claimDaily();
  const claimedAmount = result.claimed_amount ?? 1000;
  updateBalance(claimedAmount);
  markClaimedToday();
  const now = new Date().toISOString();
  setTransactions((prev) => [
    {
      id: `daily-${Date.now()}`,
      user_id: user.id,
      market_id: null,
      transaction_type: "daily_claim" as const,
      amount: claimedAmount,
      created_at: now,
    },
    ...prev,
  ]);
}, [user.id, updateBalance, markClaimedToday]);
```

---

## Clarity: "Coin Balance" vs "Active Bets"

The 5,000 cap applies to `profiles.banana_balance` (available coin balance) only. It does NOT include coins currently locked in active bets. This means:

- A user with 3,000 balance and 8,000 in active bets CAN claim daily coins (balance is below 5,000).
- A user with 5,500 balance and 0 in active bets CANNOT claim (balance is at or above 5,000).
- The distinction is important because `banana_balance` is reduced when a bet is placed and increased when a payout is received.

---

## Testing Checklist

- [ ] User with balance < 4,000 can claim full 1,000 coins
- [ ] User with balance of 4,500 can claim only 500 coins (5000 - 4500)
- [ ] User with balance >= 5,000 cannot claim (button disabled/hidden, explanatory text shown)
- [ ] User who already claimed today cannot claim again
- [ ] Claim amount text dynamically shows correct number
- [ ] Transparency text explains the 5,000 cap rule
- [ ] Active bets do not count toward the 5,000 cap
- [ ] Transaction history shows the actual claimed amount (not always 1000)
- [ ] Daily claim banner only shows when eligible

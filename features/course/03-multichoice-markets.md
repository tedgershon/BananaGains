# Feature 03: Non-Binary (Multichoice) Markets

**Phase:** 3 (depends on Phase 2)
**Dependencies:** `02-market-creation-review` (market creation form, approval workflow)
**Parallelizable with:** `07-notifications`

---

## Summary

Allow markets to be created with **multiple non-binary options** (up to 10 choices) instead of only YES/NO. Support both **mutually exclusive** outcomes (e.g., "Who will win March Madness?") and **non-exclusive** outcomes (e.g., "Which events will have >500 attendees?"). Build a multi-line probability chart, a "more bets" toggle, and a payout schema that incentivizes riskier bets.

---

## Current State

- Markets are strictly binary: YES or NO.
- Pool totals are stored directly on the `markets` table (`yes_pool_total`, `no_pool_total`).
- Bets have a `side` field constrained to `'YES'` or `'NO'`.
- The probability chart shows a single line (YES probability over time).
- All UI is built around two-outcome markets.

---

## Database Changes

### Migration 029: Market Type Column

**File:** `backend/supabase/migrations/029_market_type.sql`

```sql
-- Add market type: binary (default, backward compat) or multichoice
ALTER TABLE markets ADD COLUMN IF NOT EXISTS market_type TEXT NOT NULL DEFAULT 'binary'
    CHECK (market_type IN ('binary', 'multichoice'));

-- For multichoice, specify whether options are mutually exclusive
ALTER TABLE markets ADD COLUMN IF NOT EXISTS multichoice_type TEXT
    CHECK (multichoice_type IN ('exclusive', 'non_exclusive'));
-- exclusive: exactly one option wins (e.g., "Who will win?")
-- non_exclusive: multiple options can be true (e.g., "Which events have >500 attendees?")
```

### Migration 030: Market Options Table

**File:** `backend/supabase/migrations/030_market_options.sql`

```sql
-- Each option in a multichoice market
CREATE TABLE IF NOT EXISTS market_options (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    market_id   UUID NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
    label       TEXT NOT NULL,
    pool_total  NUMERIC NOT NULL DEFAULT 0,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    is_winner   BOOLEAN,  -- NULL while market is open, TRUE/FALSE after resolution
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_market_options_market_id ON market_options (market_id);

ALTER TABLE market_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Market options are viewable by everyone"
    ON market_options FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create options with markets"
    ON market_options FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM markets WHERE markets.id = market_id AND markets.creator_id = auth.uid()
        )
    );
```

### Migration 031: Multichoice Bets

**File:** `backend/supabase/migrations/031_multichoice_bets.sql`

```sql
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
```

### Migration 032: Place Multichoice Bet Function

**File:** `backend/supabase/migrations/032_fn_place_multichoice_bet.sql`

```sql
CREATE OR REPLACE FUNCTION place_multichoice_bet(
    p_user_id   UUID,
    p_market_id UUID,
    p_option_id UUID,
    p_amount    NUMERIC
) RETURNS JSONB AS $$
DECLARE
    v_balance       NUMERIC;
    v_market_status TEXT;
    v_market_type   TEXT;
    v_option_market UUID;
    v_bet_id        UUID;
BEGIN
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Bet amount must be positive';
    END IF;

    -- Verify option belongs to the market
    SELECT market_id INTO v_option_market
    FROM market_options WHERE id = p_option_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Option not found';
    END IF;

    IF v_option_market != p_market_id THEN
        RAISE EXCEPTION 'Option does not belong to this market';
    END IF;

    -- Lock user and check balance
    SELECT banana_balance INTO v_balance
    FROM profiles WHERE id = p_user_id FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'User not found'; END IF;
    IF v_balance < p_amount THEN RAISE EXCEPTION 'Insufficient balance'; END IF;

    -- Lock market and check status
    SELECT status, market_type INTO v_market_status, v_market_type
    FROM markets WHERE id = p_market_id FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Market not found'; END IF;
    IF v_market_status != 'open' THEN RAISE EXCEPTION 'Market is not open for betting'; END IF;
    IF v_market_type != 'multichoice' THEN RAISE EXCEPTION 'Market is not multichoice'; END IF;

    -- Deduct balance
    UPDATE profiles SET banana_balance = banana_balance - p_amount WHERE id = p_user_id;

    -- Update option pool
    UPDATE market_options SET pool_total = pool_total + p_amount WHERE id = p_option_id;

    -- Record the bet
    INSERT INTO bets (user_id, market_id, option_id, amount)
    VALUES (p_user_id, p_market_id, p_option_id, p_amount)
    RETURNING id INTO v_bet_id;

    -- Record transaction
    INSERT INTO transactions (user_id, market_id, transaction_type, amount)
    VALUES (p_user_id, p_market_id, 'bet_placement', -p_amount);

    RETURN jsonb_build_object(
        'bet_id', v_bet_id,
        'new_balance', v_balance - p_amount
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Migration 033: Resolve Multichoice Market Function

**File:** `backend/supabase/migrations/033_fn_resolve_multichoice.sql`

```sql
-- Resolve a multichoice market
-- p_winning_option_ids: array of option UUIDs that are winners
-- For exclusive: exactly one winner
-- For non_exclusive: one or more winners
CREATE OR REPLACE FUNCTION resolve_multichoice_market(
    p_market_id UUID,
    p_winning_option_ids UUID[]
) RETURNS JSONB AS $$
DECLARE
    v_market_type TEXT;
    v_multichoice_type TEXT;
    v_status TEXT;
    v_total_pool NUMERIC := 0;
    v_winning_pool NUMERIC := 0;
    v_opt RECORD;
    v_bet RECORD;
    v_payout NUMERIC;
BEGIN
    SELECT market_type, multichoice_type, status
    INTO v_market_type, v_multichoice_type, v_status
    FROM markets WHERE id = p_market_id FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Market not found'; END IF;
    IF v_market_type != 'multichoice' THEN RAISE EXCEPTION 'Not a multichoice market'; END IF;
    IF v_status NOT IN ('pending_resolution', 'disputed', 'admin_review', 'closed') THEN
        RAISE EXCEPTION 'Market cannot be resolved from status: %', v_status;
    END IF;

    IF v_multichoice_type = 'exclusive' AND array_length(p_winning_option_ids, 1) != 1 THEN
        RAISE EXCEPTION 'Exclusive markets must have exactly one winner';
    END IF;

    -- Mark winning and losing options
    UPDATE market_options SET is_winner = FALSE WHERE market_id = p_market_id;
    UPDATE market_options SET is_winner = TRUE WHERE id = ANY(p_winning_option_ids);

    -- Calculate total pool and winning pool
    SELECT COALESCE(SUM(pool_total), 0) INTO v_total_pool
    FROM market_options WHERE market_id = p_market_id;

    SELECT COALESCE(SUM(pool_total), 0) INTO v_winning_pool
    FROM market_options WHERE id = ANY(p_winning_option_ids);

    -- Update market status
    UPDATE markets SET
        status = 'resolved',
        resolved_at = now()
    WHERE id = p_market_id;

    -- Distribute payouts
    IF v_winning_pool = 0 THEN
        -- No one bet on winning options: refund everyone
        FOR v_bet IN
            SELECT user_id, amount FROM bets WHERE market_id = p_market_id
        LOOP
            UPDATE profiles SET banana_balance = banana_balance + v_bet.amount WHERE id = v_bet.user_id;
            INSERT INTO transactions (user_id, market_id, transaction_type, amount)
            VALUES (v_bet.user_id, p_market_id, 'payout', v_bet.amount);
        END LOOP;
    ELSE
        -- Proportional payout to winners
        FOR v_bet IN
            SELECT user_id, SUM(amount) AS user_total
            FROM bets
            WHERE market_id = p_market_id AND option_id = ANY(p_winning_option_ids)
            GROUP BY user_id
        LOOP
            v_payout := TRUNC(v_bet.user_total * (v_total_pool / v_winning_pool), 2);
            UPDATE profiles SET banana_balance = banana_balance + v_payout WHERE id = v_bet.user_id;
            INSERT INTO transactions (user_id, market_id, transaction_type, amount)
            VALUES (v_bet.user_id, p_market_id, 'payout', v_payout);
        END LOOP;
    END IF;

    RETURN jsonb_build_object(
        'market_id', p_market_id,
        'status', 'resolved',
        'winning_options', p_winning_option_ids
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## Payout Schema for Multichoice Markets

### Exclusive Markets (exactly one winner)

Standard parimutuel: total pool is divided proportionally among bettors who chose the winning option.

```
payout_per_user = user_bet_on_winner * (total_pool / winning_option_pool)
```

This naturally incentivizes riskier bets — if you bet on a long-shot option with a small pool, your proportional share of the total pool is larger if that option wins.

### Non-Exclusive Markets (multiple options can win)

For comparison-type markets where multiple options can be true:

- Each winning option's bettors receive their proportional share of the **losing options' pools** distributed across all winning pools.
- Specifically: `payout = user_bet * (total_pool / sum_of_all_winning_pools)`
- This means if most options win, individual payouts are modest (low risk). If few options win, payouts are large (high risk rewarded).

This incentivizes betting on outcomes that are less likely, since fewer winners = bigger payout ratio.

---

## Backend Changes

### Modify: `backend/schemas/market.py`

Add multichoice-related fields:

```python
class CreateMarketRequest(BaseModel):
    # ... existing fields ...
    market_type: Literal["binary", "multichoice"] = "binary"  # NEW
    multichoice_type: Literal["exclusive", "non_exclusive"] | None = None  # NEW
    options: list[str] | None = None  # NEW: list of option labels (2-10)

    @field_validator("options")
    @classmethod
    def validate_options(cls, v, info):
        if info.data.get("market_type") == "multichoice":
            if v is None or len(v) < 2:
                raise ValueError("Multichoice markets require at least 2 options")
            if len(v) > 10:
                raise ValueError("Maximum 10 options allowed")
            # Check for duplicate labels
            if len(set(v)) != len(v):
                raise ValueError("Option labels must be unique")
        return v

    @field_validator("multichoice_type")
    @classmethod
    def validate_multichoice_type(cls, v, info):
        if info.data.get("market_type") == "multichoice" and v is None:
            raise ValueError("multichoice_type is required for multichoice markets")
        return v
```

Add option response schema:

```python
class MarketOptionResponse(BaseModel):
    id: str
    market_id: str
    label: str
    pool_total: float
    sort_order: int
    is_winner: bool | None = None
    created_at: datetime

class MarketResponse(BaseModel):
    # ... existing fields ...
    market_type: str = "binary"  # NEW
    multichoice_type: str | None = None  # NEW
    options: list[MarketOptionResponse] | None = None  # NEW (populated for multichoice)
```

### Modify: `backend/routers/markets.py`

**Update `create_market`:**

When `market_type == "multichoice"`:
1. Insert the market record with `market_type` and `multichoice_type`.
2. For each option label in `body.options`, insert a row into `market_options` with the market ID and a sequential `sort_order`.
3. For binary markets: leave `yes_criteria` and `no_criteria` as-is.
4. For multichoice markets: `yes_criteria`/`no_criteria` may be null; `resolution_criteria` should describe the overall resolution approach.

**Update `get_market` and `list_markets`:**

For multichoice markets, join with `market_options` to include the options array in the response:

```python
if market["market_type"] == "multichoice":
    options = (
        supabase.table("market_options")
        .select("*")
        .eq("market_id", market["id"])
        .order("sort_order")
        .execute()
    )
    market["options"] = options.data or []
```

### Modify: `backend/routers/bets.py`

**Add multichoice bet endpoint:**

```python
@router.post("/{market_id}/bets/option", response_model=PlaceBetResponse, status_code=201)
async def place_multichoice_bet(
    market_id: str,
    body: PlaceMultichoiceBetRequest,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client),
):
    result = supabase.rpc("place_multichoice_bet", {
        "p_user_id": current_user["id"],
        "p_market_id": market_id,
        "p_option_id": body.option_id,
        "p_amount": body.amount,
    }).execute()
    return result.data
```

Add the request schema:

```python
class PlaceMultichoiceBetRequest(BaseModel):
    option_id: str
    amount: float

    @field_validator("amount")
    @classmethod
    def amount_positive(cls, v):
        if v <= 0:
            raise ValueError("Bet amount must be positive")
        return v
```

---

## Frontend Changes

### Update: Market Creation Form (`frontend/src/app/markets/create/page.tsx`)

#### Market Type Selector

At the top of the form, add a segmented control:

```tsx
<div className="space-y-1.5">
  <label className="text-sm font-medium">Market Type</label>
  <div className="flex gap-2">
    <button
      type="button"
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
        marketType === "binary"
          ? "bg-primary text-primary-foreground"
          : "bg-secondary text-secondary-foreground"
      }`}
      onClick={() => setMarketType("binary")}
    >
      Yes / No
    </button>
    <button
      type="button"
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
        marketType === "multichoice"
          ? "bg-primary text-primary-foreground"
          : "bg-secondary text-secondary-foreground"
      }`}
      onClick={() => setMarketType("multichoice")}
    >
      Multiple Choice
    </button>
  </div>
</div>
```

#### When "Multiple Choice" is selected:

1. **Hide** Yes Criteria and No Criteria fields.
2. **Show** a "Multichoice Type" selector:
   - "Mutually Exclusive" — exactly one option wins (e.g., election, competition)
   - "Multiple Can Win" — any number of options can be true (e.g., threshold events)
3. **Show** an "Options" section where the user can add up to 10 options:
   - Start with 2 empty option fields
   - Each field has a text input and a remove button (unless only 2 remain)
   - An "Add Option" button appears below (disabled if 10 options exist)
   - Display count: "3 of 10 options"

#### When "Yes / No" is selected:

- Show the existing Yes Criteria and No Criteria fields (current behavior).

### Update: Market Detail Page (`frontend/src/app/markets/[id]/page.tsx`)

#### For Multichoice Markets:

**Probability Chart:**
- Instead of a single YES probability line, render one line per option using different colors.
- **Default display:** Show only the top 3 options by market share (pool_total / total_pool).
- **Dropdown:** Add a dropdown menu below the chart labeled "Showing top 3 options" with checkboxes for each option, allowing the user to toggle visibility of individual option lines.
- Use distinct colors from the existing chart color palette (`--chart-1` through `--chart-5`, then cycle or generate additional colors for options 6-10).
- Each line should be labeled with the option name at the rightmost data point.

**Betting Panel:**
- Replace the YES/NO buttons with a list of options, each with:
  - Option label
  - Current probability percentage
  - A "Bet" button
- When user clicks "Bet" on an option, show the amount input and a confirm button.
- **"More Bets" toggle:** If more than 3 options exist, initially show only the top 3 by market share. Add a "Show all options" or "More bets" toggle that reveals the remaining options.

**Market Info Card:**
- Show "Market Type: Multiple Choice (Exclusive)" or "(Non-Exclusive)" in the info grid.
- Replace "Yes Pool" / "No Pool" with a breakdown showing each option's pool total and percentage:
  ```
  Option A    🍌 450   (45%)
  Option B    🍌 300   (30%)
  Option C    🍌 250   (25%)
  ```

**Resolution Display:**
- When resolved, highlight the winning option(s) with a green badge/checkmark.
- Show losing options dimmed or with a red X.

### Update: `frontend/src/lib/types.ts`

```typescript
export interface MarketOption {
  id: string;
  market_id: string;
  label: string;
  pool_total: number;
  sort_order: number;
  is_winner: boolean | null;
  created_at: string;
}

export interface Market {
  // ... existing fields ...
  market_type: "binary" | "multichoice";
  multichoice_type: "exclusive" | "non_exclusive" | null;
  options?: MarketOption[] | null;
}
```

### Update: `frontend/src/components/probability-chart.tsx`

Create a new version or variant that supports multiple lines:

```typescript
interface MultiProbabilityChartProps {
  options: MarketOption[];
  bets: Bet[];  // all bets for this market (with option_id)
  visibleOptionIds: string[];  // which options to show lines for
}
```

Build the price history per-option:
- For each bet on a given option, recalculate that option's share of the total pool.
- Each option gets its own data series.
- Use Recharts `<Line>` component for each visible option, with distinct `stroke` colors.

### Update: `frontend/src/components/market-card.tsx`

For multichoice markets on the market list:
- Instead of showing a single "YES %" probability, show the top option's label and percentage:
  ```
  Leading: Option A (45%)
  ```
- Use a subtle indicator to show it's multichoice (e.g., a small icon or "MC" badge).

### Update: `frontend/src/lib/api.ts`

```typescript
export function placeMultichoiceBet(
  marketId: string,
  body: { option_id: string; amount: number },
): Promise<PlaceBetResponse> {
  return apiFetch(`/api/markets/${marketId}/bets/option`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
```

---

## Styling Guidance

- Keep multichoice styling **as close to the binary market styling as possible**. The same card layouts, font sizes, and color scheme should be used.
- The option list in the betting panel should use the same button styling as YES/NO buttons, but vertically stacked instead of side-by-side.
- Each option button should show the option label and its current probability.
- Use the chart color palette consistently between the probability chart lines and the option buttons.

---

## Testing Checklist

- [ ] Can create a multichoice market with 2-10 options
- [ ] Cannot create multichoice market with 0-1 or >10 options
- [ ] Multichoice type (exclusive/non_exclusive) is required for multichoice markets
- [ ] Placing a bet on an option updates that option's pool correctly
- [ ] Probability chart shows multiple lines for multichoice markets
- [ ] "More bets" toggle shows/hides additional options beyond top 3
- [ ] Binary markets continue to work unchanged
- [ ] Resolving an exclusive market with exactly 1 winner distributes payouts correctly
- [ ] Resolving a non-exclusive market with multiple winners distributes payouts correctly
- [ ] Payout incentivizes riskier bets (long-shot options yield higher returns)
- [ ] Market card shows leading option for multichoice markets
- [ ] Market detail shows option breakdown in info card
- [ ] Dropdown in chart allows toggling option line visibility

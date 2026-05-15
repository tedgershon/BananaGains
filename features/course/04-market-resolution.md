# Feature 04: Automated Market Resolution & Community Voting

**Phase:** 2 (depends on Phase 1)
**Dependencies:** `01-admin-system` (admin fallback for inconclusive votes)
**Parallelizable with:** `02-market-creation-review`, `10-safety-logic`

---

## Summary

Add a **parallel resolution track** alongside the existing creator-resolution path. When a market closes, a 24-hour automated resolution period begins. During this window, community members can vote on the outcome. After 24 hours, if the community vote is decisive, the market resolves accordingly. If not, it escalates to admin review. Voters receive a coin reward (4% of the total market pool) for participating. Add a **Resolutions** tab in the navbar showing all markets currently in their resolution period with countdown timers.

**Key design decision:** Both resolution paths coexist. The creator can still propose a resolution (existing flow), AND the community voting track runs in parallel. Whichever produces a decisive outcome first is used.

---

## Current State

- Markets transition: `open` → `closed` → creator proposes → `pending_resolution` (24h dispute window) → `resolved` or `disputed` → voter voting → `resolved` or `admin_review`.
- The `close_expired_markets()` function closes markets whose `close_at` has passed.
- Lazy transitions in `_apply_lazy_transitions` handle state changes when markets are fetched.
- Community voting currently only happens during disputes (neutral voters, no bettors allowed).
- No "Resolutions" tab exists.
- No voter rewards for resolution voting.

---

## Architecture: Dual Resolution Tracks

```
Market closes
    │
    ├── Track A: Creator Resolution (existing)
    │   └── Creator proposes outcome → 24h dispute window → resolve or dispute
    │
    └── Track B: Community Resolution (NEW)
        └── 24h voting window → decisive vote → resolve
        └── OR → inconclusive → admin_review
```

**Rules:**
1. When a market closes, a 24-hour `resolution_window_end` timestamp is set.
2. During this 24-hour window:
   - The creator can propose a resolution (Track A, existing behavior).
   - Any authenticated user can cast a community resolution vote (Track B, new).
3. After 24 hours:
   - If the creator proposed and the dispute window hasn't been triggered, finalize with the creator's proposed outcome.
   - If the community vote is decisive (clear majority with quorum), finalize with the community vote.
   - If both produce the same outcome, finalize.
   - If they conflict, escalate to admin review.
   - If neither track has a result, escalate to admin review.
4. Voters who voted with the winning outcome receive a share of the voter reward pool.

---

## Database Changes

### Migration 034: Resolution Window Columns

**File:** `backend/supabase/migrations/034_resolution_window.sql`

```sql
-- Add resolution window tracking
ALTER TABLE markets ADD COLUMN IF NOT EXISTS resolution_window_end TIMESTAMPTZ;

-- Track community votes separately from dispute votes
CREATE TABLE IF NOT EXISTS community_votes (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    market_id         UUID NOT NULL REFERENCES markets(id),
    voter_id          UUID NOT NULL REFERENCES profiles(id),
    selected_outcome  TEXT NOT NULL CHECK (selected_outcome IN ('YES', 'NO')),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (market_id, voter_id)
);

CREATE INDEX IF NOT EXISTS idx_community_votes_market_id ON community_votes (market_id);

ALTER TABLE community_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Community votes are viewable by everyone"
    ON community_votes FOR SELECT USING (true);
CREATE POLICY "Authenticated users can cast community votes"
    ON community_votes FOR INSERT WITH CHECK (auth.uid() = voter_id);
```

### Migration 035: Community Vote Function

**File:** `backend/supabase/migrations/035_fn_cast_community_vote.sql`

```sql
CREATE OR REPLACE FUNCTION cast_community_vote(
    p_market_id UUID,
    p_voter_id  UUID,
    p_vote      TEXT
) RETURNS JSONB AS $$
DECLARE
    v_status TEXT;
    v_resolution_end TIMESTAMPTZ;
    v_vote_id UUID;
BEGIN
    IF p_vote NOT IN ('YES', 'NO') THEN
        RAISE EXCEPTION 'Invalid vote: must be YES or NO';
    END IF;

    SELECT status, resolution_window_end INTO v_status, v_resolution_end
    FROM markets WHERE id = p_market_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Market not found';
    END IF;

    -- Allow voting during closed, pending_resolution states while within resolution window
    IF v_status NOT IN ('closed', 'pending_resolution') THEN
        RAISE EXCEPTION 'Market is not in the resolution period';
    END IF;

    IF v_resolution_end IS NULL THEN
        RAISE EXCEPTION 'Resolution window has not been set for this market';
    END IF;

    IF now() >= v_resolution_end THEN
        RAISE EXCEPTION 'Resolution voting window has expired';
    END IF;

    INSERT INTO community_votes (market_id, voter_id, selected_outcome)
    VALUES (p_market_id, p_voter_id, p_vote)
    RETURNING id INTO v_vote_id;

    RETURN jsonb_build_object(
        'id', v_vote_id,
        'market_id', p_market_id,
        'voter_id', p_voter_id,
        'selected_outcome', p_vote
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Migration 036: Voter Reward Transaction Type

**File:** `backend/supabase/migrations/036_voter_reward_type.sql`

```sql
-- Add resolution_vote_reward to transaction types if not present
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_transaction_type_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_transaction_type_check
    CHECK (transaction_type IN (
        'initial_grant', 'bet_placement', 'payout',
        'voter_stake', 'voter_reward', 'daily_claim',
        'resolution_vote_reward'
    ));
```

### Migration 037: Auto-Set Resolution Window on Close

**File:** `backend/supabase/migrations/037_fn_auto_resolution_window.sql`

```sql
-- When a market transitions to 'closed', auto-set the resolution window
CREATE OR REPLACE FUNCTION set_resolution_window()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.status = 'closed' AND OLD.status = 'open' AND NEW.resolution_window_end IS NULL THEN
        NEW.resolution_window_end := now() + interval '24 hours';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_set_resolution_window ON markets;
CREATE TRIGGER auto_set_resolution_window
    BEFORE UPDATE ON markets
    FOR EACH ROW EXECUTE FUNCTION set_resolution_window();

-- Also handle the close_expired_markets function
CREATE OR REPLACE FUNCTION close_expired_markets()
RETURNS void AS $$
BEGIN
    UPDATE markets
    SET status = 'closed',
        resolution_window_end = now() + interval '24 hours'
    WHERE status = 'open'
      AND close_at <= now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## Voter Reward Calculation

**Reward pool:** 4% of the total market pool (all coins bet).

**Distribution:**
- Only voters who voted for the **winning outcome** receive rewards.
- Each winning voter gets an equal share: `reward_per_voter = (total_pool * 0.04) / num_winning_voters`.
- The reward is minted (created from nothing, not taken from the betting pool). This means bettors' payouts are unaffected by voter rewards.
- This encourages honest voting: vote correctly → get rewarded.

**Example:**
- Market has 10,000 bananas total pool.
- 4% = 400 banana reward pool.
- 8 users voted: 6 voted YES (correct), 2 voted NO.
- Each correct voter gets: 400 / 6 = 66.67 bananas.
- Incorrect voters get nothing.

**Why 4%:** Balances being substantial enough to incentivize participation while being small enough not to inflate the currency excessively. At 3%, the incentive may be too low for users to bother voting on smaller markets. At 5%, rapid inflation becomes a concern with many markets resolving daily.

---

## Backend Changes

### New File: `backend/routers/resolution.py`

```python
router = APIRouter(prefix="/api/markets", tags=["resolution"])

@router.post("/{market_id}/community-vote")
async def cast_community_vote(
    market_id: str,
    body: CastVoteRequest,  # reuse existing schema with vote field
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client),
):
    """Cast a community resolution vote during the 24h resolution window."""
    try:
        result = supabase.rpc("cast_community_vote", {
            "p_market_id": market_id,
            "p_voter_id": current_user["id"],
            "p_vote": body.vote,
        }).execute()
        return result.data
    except Exception as e:
        msg = str(e).lower()
        if "not in the resolution" in msg:
            raise HTTPException(400, "Market is not in the resolution period.")
        if "expired" in msg:
            raise HTTPException(400, "Resolution voting window has expired.")
        if "unique" in msg or "duplicate" in msg:
            raise HTTPException(409, "You have already voted on this market's resolution.")
        raise HTTPException(500, f"Failed to cast vote: {e}")


@router.get("/{market_id}/community-votes")
async def list_community_votes(
    market_id: str,
    supabase: Client = Depends(get_supabase_client),
):
    """List all community resolution votes for a market."""
    result = (
        supabase.table("community_votes")
        .select("*")
        .eq("market_id", market_id)
        .order("created_at")
        .execute()
    )
    return result.data or []


@router.get("/resolutions")
async def list_resolution_markets(
    supabase: Client = Depends(get_supabase_client),
    _current_user: dict | None = Depends(get_current_user_optional),
):
    """List markets currently in their resolution period, sorted by expiration (soonest first)."""
    result = (
        supabase.table("markets")
        .select("*")
        .in_("status", ["closed", "pending_resolution"])
        .not_.is_("resolution_window_end", "null")
        .gt("resolution_window_end", datetime.now(tz=timezone.utc).isoformat())
        .order("resolution_window_end", desc=False)
        .execute()
    )
    return result.data or []
```

### Modify: `backend/routers/markets.py` — `_apply_lazy_transitions`

Add logic to handle resolution window expiry:

```python
# After the existing finalize_markets and tally_markets logic, add:

# Auto-finalize markets whose resolution window has expired
for m in markets:
    if m.get("status") in ("closed", "pending_resolution") and m.get("resolution_window_end"):
        window_end = datetime.fromisoformat(m["resolution_window_end"])
        if window_end <= now and m["status"] not in ("resolved", "admin_review"):
            # Tally community votes
            votes = (
                supabase.table("community_votes")
                .select("selected_outcome")
                .eq("market_id", m["id"])
                .execute()
            )
            yes_votes = sum(1 for v in (votes.data or []) if v["selected_outcome"] == "YES")
            no_votes = sum(1 for v in (votes.data or []) if v["selected_outcome"] == "NO")
            total_votes = yes_votes + no_votes

            COMMUNITY_QUORUM = 3

            if total_votes >= COMMUNITY_QUORUM and yes_votes != no_votes:
                winning = "YES" if yes_votes > no_votes else "NO"
                try:
                    # Finalize market
                    supabase.rpc("finalize_resolution", {
                        "p_market_id": m["id"],
                        "p_outcome": winning,
                    }).execute()
                    m["status"] = "resolved"
                    m["resolved_outcome"] = winning

                    # Distribute voter rewards
                    _distribute_voter_rewards(supabase, m["id"], winning)
                except Exception:
                    pass
            else:
                # Inconclusive or no quorum → admin review
                supabase.table("markets").update({"status": "admin_review"}).eq("id", m["id"]).execute()
                m["status"] = "admin_review"
```

### New Helper: `_distribute_voter_rewards`

```python
def _distribute_voter_rewards(supabase: Client, market_id: str, winning_outcome: str):
    """Distribute 4% of total pool to voters who voted correctly."""
    market = supabase.table("markets").select("yes_pool_total, no_pool_total").eq("id", market_id).single().execute()
    if not market.data:
        return

    total_pool = market.data["yes_pool_total"] + market.data["no_pool_total"]
    reward_pool = total_pool * 0.04

    # Get winning voters
    winning_voters = (
        supabase.table("community_votes")
        .select("voter_id")
        .eq("market_id", market_id)
        .eq("selected_outcome", winning_outcome)
        .execute()
    )

    if not winning_voters.data or len(winning_voters.data) == 0:
        return

    reward_per_voter = round(reward_pool / len(winning_voters.data), 2)
    if reward_per_voter <= 0:
        return

    for voter in winning_voters.data:
        supabase.table("profiles").update({
            "banana_balance": supabase.rpc("add_balance", {  # or raw SQL
                "p_user_id": voter["voter_id"],
                "p_amount": reward_per_voter,
            })
        })
        # Simpler approach: direct update
        supabase.rpc("sql", {"query": f"""
            UPDATE profiles SET banana_balance = banana_balance + {reward_per_voter}
            WHERE id = '{voter["voter_id"]}'
        """})

        supabase.table("transactions").insert({
            "user_id": voter["voter_id"],
            "market_id": market_id,
            "transaction_type": "resolution_vote_reward",
            "amount": reward_per_voter,
        }).execute()
```

**Note to implementer:** The reward distribution above is pseudocode. The actual implementation should use a proper SQL function to atomically update balances and insert transactions in a single transaction, similar to the existing `finalize_resolution` pattern. Create a `distribute_voter_rewards(p_market_id, p_winning_outcome, p_reward_pct)` Postgres function.

### Modify: `backend/main.py`

Register the new resolution router:
```python
from routers import resolution
app.include_router(resolution.router)
```

---

## Frontend Changes

### New Page: `frontend/src/app/resolutions/page.tsx`

**Resolutions Tab** — shows all markets currently in their resolution period.

**Layout:**
- Header: "Resolutions" with subtitle explaining importance of voting
- Info banner (top of page):
  ```
  Your vote matters! Help resolve markets by voting on the correct outcome.
  Correct voters earn banana coin rewards. Incorrect votes will result in
  forfeiture of the coin prize for voting.
  ```
  (Using forfeiture language rather than temporary bans, per the simpler approach.)
- Markets listed in order of **expiration time** (soonest first).

**Each market card shows:**
- Market title (clickable, links to market detail page)
- **Creator's Call:** "Undecided", "YES", or "NO" — shows the creator's proposed outcome (or lack thereof) so voters can factor it in
- Current community vote tally (YES: X, NO: Y)
- **Countdown timer:** "Resolves in 3h 42m" or "Resolves in 18h 5m" — computed from `resolution_window_end`
  - Use a real-time countdown that updates every second (or minute).
  - When time is < 1 hour, show in red for urgency.
- **Voter reward:** Display the reward amount: "Vote reward: ~X bananas" where X = `(total_pool * 0.04) / estimated_winning_voters` (or show the total reward pool: "Reward pool: X bananas")
- **Vote buttons:** YES / NO (same styling as bet buttons but smaller)
  - Disabled if user has already voted (check via API)
  - Disabled if the resolution window has expired
  - **Hidden entirely if the current user is the market creator** (with explanatory text: "You are the creator of this market")

**Data fetching:**
- Call `GET /api/markets/resolutions` on mount to get markets in resolution period.
- For each market, also fetch community vote counts.
- Refresh periodically (every 30 seconds) to update countdown and vote counts.

### Update: `frontend/src/components/navbar.tsx`

Add "Resolutions" to the navigation links:

```typescript
const NAV_LINKS = [
  { href: "/", label: "Markets" },
  { href: "/resolutions", label: "Resolutions" },
  { href: "/leaderboard", label: "Leaderboard" },
];
```

### Update: Market Detail Page (`frontend/src/app/markets/[id]/page.tsx`)

When a market is in `closed` status and has a `resolution_window_end` in the future:

1. **Show a "Community Resolution" section** in the right panel:
   - **"Creator's Call"** indicator at the top — shows "Undecided", "YES", or "NO" based on `proposed_outcome`
   - Countdown timer showing time remaining
   - Current vote tally (YES: X, NO: Y)
   - Vote buttons (YES / NO)
   - Small text: "Earn ~X bananas for voting correctly"
   - If user has already voted, show "You voted YES/NO" and disable buttons
   - If user is the market creator, **hide vote buttons entirely** and show: "As the market creator, you propose a resolution via the Creator Resolution section below."

2. **Keep the existing creator resolution section** — both should be visible simultaneously.

3. **Show voter reward info** in the Market Info card:
   - "Voter Reward Pool: 🍌 X" (4% of total pool)

### Update: `frontend/src/lib/types.ts`

```typescript
export interface Market {
  // ... existing fields ...
  resolution_window_end?: string | null;  // NEW
}

export interface CommunityVote {
  id: string;
  market_id: string;
  voter_id: string;
  selected_outcome: BetSide;
  created_at: string;
}
```

### Update: `frontend/src/lib/api.ts`

```typescript
export function castCommunityVote(
  marketId: string,
  body: CastVoteRequest,
): Promise<CommunityVote> {
  return apiFetch(`/api/markets/${marketId}/community-vote`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function listCommunityVotes(marketId: string): Promise<CommunityVote[]> {
  return apiFetch(`/api/markets/${marketId}/community-votes`);
}

export function listResolutionMarkets(): Promise<Market[]> {
  return apiFetch("/api/markets/resolutions");
}
```

---

## Resolution Flow Summary (After Implementation)

```
Market close_at passes
    │
    ├── Market status → 'closed'
    ├── resolution_window_end → now + 24h
    │
    │   During 24h window:
    │   ├── Track A: Creator proposes resolution (existing)
    │   │   └── Sets proposed_outcome, dispute_deadline
    │   └── Track B: Users cast community votes (new)
    │       └── Votes accumulate in community_votes table
    │
    └── After 24 hours (handled lazily on next fetch):
        │
        ├── If creator proposed & no dispute → finalize with creator outcome
        │   └── Award voter rewards to matching community voters
        │
        ├── If community vote decisive (quorum met, clear majority) → finalize
        │   └── Award voter rewards to correct voters
        │
        ├── If creator proposed & disputed → existing dispute flow continues
        │   └── Dispute voting proceeds as before
        │
        └── If inconclusive / no activity → status → 'admin_review'
            └── Admin resolves manually
```

---

## Important: Creator Restrictions

**The market creator CANNOT cast a community vote on their own market.** The creator already has their own resolution track (Track A) where they propose an outcome. Allowing them to also vote in the community track would give them disproportionate influence.

The `cast_community_vote` function enforces this:

```sql
-- Inside cast_community_vote(), after the market status checks:
DECLARE
    v_creator_id UUID;
BEGIN
    -- ...existing checks...

    SELECT creator_id INTO v_creator_id FROM markets WHERE id = p_market_id;

    IF p_voter_id = v_creator_id THEN
        RAISE EXCEPTION 'Market creators cannot cast community votes on their own market';
    END IF;

    -- ...rest of function...
```

**Bettors (non-creators) CAN still vote.** Unlike the existing dispute voting (where bettors are excluded), community resolution voting allows all authenticated users except the creator to vote because:
- The voting is about factual resolution (what actually happened), not about dispute adjudication.
- Bettors have skin in the game and may have better information about the outcome.
- The 4% reward pool is separate from bet payouts, so there's no direct financial conflict beyond their bet position.

## Creator Resolution Display ("Creator's Call")

During the 24-hour dual-track resolution window, the community should be able to see what the creator has proposed (or that they haven't proposed yet). This transparency helps voters make informed decisions and understand both resolution tracks.

### Display Rules

| Creator state | What community voters see |
|---|---|
| Creator has NOT proposed a resolution yet | **"Creator's Call: Undecided"** (gray/muted styling) |
| Creator proposed YES | **"Creator's Call: YES"** (green badge) |
| Creator proposed NO | **"Creator's Call: NO"** (red badge) |

### Frontend Implementation

**In the Resolutions page (`app/resolutions/page.tsx`)** and **Market Detail page (`app/markets/[id]/page.tsx`)**:

Within the community resolution section, add a "Creator's Call" indicator above or beside the community vote tally:

```tsx
{/* Creator Resolution Track indicator */}
<div className="flex items-center gap-2 text-sm">
  <span className="text-muted-foreground">Creator's Call:</span>
  {market.proposed_outcome ? (
    <span className={cn(
      "px-2 py-0.5 rounded-full text-xs font-semibold",
      market.proposed_outcome === "YES"
        ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
        : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
    )}>
      {market.proposed_outcome}
    </span>
  ) : (
    <span className="text-muted-foreground italic">Undecided</span>
  )}
</div>
```

This should appear:
1. On each resolution market card on the Resolutions page
2. In the "Community Resolution" section on the market detail page
3. Positioned just above the community vote tally (YES: X, NO: Y) so voters can see both tracks at a glance

### Data Requirements

The `proposed_outcome` field already exists on the `markets` table (from the existing creator resolution flow). Ensure the market response includes this field so the frontend can render the creator's call status. No additional database changes are needed for this display.

---

## Testing Checklist

- [ ] When a market closes, `resolution_window_end` is set to now + 24h
- [ ] Resolutions page shows markets in resolution period, sorted by expiry
- [ ] Countdown timer updates correctly
- [ ] Users can cast community votes during the resolution window
- [ ] Users cannot vote after the resolution window expires
- [ ] Users cannot vote twice on the same market
- [ ] **Market creator CANNOT cast a community vote on their own market** (SQL function raises exception)
- [ ] **Creator vote buttons are hidden on frontend** with explanatory text
- [ ] After 24h, decisive community vote resolves the market
- [ ] After 24h, inconclusive vote sends market to admin_review
- [ ] Voter rewards (4% of pool) distributed to correct voters
- [ ] Creator resolution track still works in parallel
- [ ] Both tracks coexisting doesn't cause double-resolution
- [ ] Voter reward shows correctly on Resolutions page
- [ ] Transaction history shows "Resolution Vote Reward" entries
- [ ] **"Creator's Call" shows "Undecided"** when creator has not proposed an outcome
- [ ] **"Creator's Call" shows "YES" or "NO"** when creator has proposed an outcome
- [ ] Creator's Call is visible on both the Resolutions page cards and the market detail page

# Feature 08: Main Page — Hottest Market, Trending, Top Markets, Weekly Leaderboard

**Phase:** 4 (depends on Phases 2–3)
**Dependencies:** `02-market-creation-review` (markets must be approved/open), `04-market-resolution` (resolution data for resolved markets)
**Parallelizable with:** `09-claimable-rewards`

---

## Summary

Rebuild the homepage to feature four new sections: a **Hottest Market** big display (Kalshi-style), a **Weekly Leaderboard** based on rolling 7-day gains, **Trending Markets** ranked by recency and activity, and **Top Markets** ranked by total coin volume. The current market list remains but is reorganized below these headline sections.

---

## Current State

- The homepage (`frontend/src/app/page.tsx`) shows:
  - A category filter bar
  - "Open Markets" grid
  - "Closed & Resolved" grid
- No "hottest market" feature.
- No trending or top markets ranking.
- Leaderboard page exists but ranks by total balance, not by gains.

---

## Visual Reference

- **Hottest Market:** Based on `kalshi-top-market.png` — large card with market title, options with percentages, a graph, total volume, and a description/news section. Features pagination ("1 of N").
- **Trending/Top Markets:** Based on `kalshi-trend.png` — numbered list (#1–#3) with market title, leading outcome percentage, and dominant choice. Excludes trend arrows (we cannot model this yet).

---

## Backend Changes

### Modify: `backend/routers/markets.py`

#### New Endpoint: `GET /api/markets/hot`

Returns the top 5 "hottest" open markets, ranked by total coin volume (most coins bet).

```python
@router.get("/hot", response_model=list[MarketResponse])
async def get_hot_markets(
    limit: int = Query(5, ge=1, le=10),
    supabase: Client = Depends(get_supabase_client),
    _current_user: dict | None = Depends(get_current_user_optional),
):
    """Top markets by total coin volume (yes_pool + no_pool)."""
    # Supabase doesn't support computed column ordering directly,
    # so fetch open markets and sort in Python
    result = (
        supabase.table("markets")
        .select("*")
        .eq("status", "open")
        .execute()
    )
    markets = result.data or []
    markets.sort(key=lambda m: m["yes_pool_total"] + m["no_pool_total"], reverse=True)
    return _apply_lazy_transitions(markets[:limit], supabase)
```

**Note:** If performance is a concern with many markets, consider adding a computed column or a view in Postgres:
```sql
CREATE VIEW v_hot_markets AS
SELECT *, (yes_pool_total + no_pool_total) AS total_volume
FROM markets WHERE status = 'open'
ORDER BY total_volume DESC;
```

#### New Endpoint: `GET /api/markets/trending`

Returns the top 3 "trending" markets — open markets that are **recent AND have activity above a threshold**.

```python
TRENDING_MIN_VOLUME = 100  # Minimum total coins to qualify as trending
TRENDING_RECENCY_DAYS = 7  # Markets created within the last N days

@router.get("/trending", response_model=list[MarketResponse])
async def get_trending_markets(
    limit: int = Query(3, ge=1, le=10),
    supabase: Client = Depends(get_supabase_client),
    _current_user: dict | None = Depends(get_current_user_optional),
):
    """Trending markets: recently created + minimum activity threshold."""
    cutoff = (datetime.now(tz=timezone.utc) - timedelta(days=TRENDING_RECENCY_DAYS)).isoformat()

    result = (
        supabase.table("markets")
        .select("*")
        .eq("status", "open")
        .gte("created_at", cutoff)
        .execute()
    )
    markets = result.data or []

    # Filter by minimum volume threshold
    qualified = [m for m in markets if (m["yes_pool_total"] + m["no_pool_total"]) >= TRENDING_MIN_VOLUME]

    # Sort by recency (newest first), breaking ties by volume
    qualified.sort(key=lambda m: (m["created_at"], m["yes_pool_total"] + m["no_pool_total"]), reverse=True)

    # If fewer than 3 qualify, include any open market to fill
    if len(qualified) < limit:
        remaining = [m for m in markets if m not in qualified]
        remaining.sort(key=lambda m: m["created_at"], reverse=True)
        qualified.extend(remaining[:limit - len(qualified)])

    return _apply_lazy_transitions(qualified[:limit], supabase)
```

**Alternative trending criteria (recommended to implementer):** Instead of pure recency, consider a composite score:
```
trending_score = (volume_growth_last_24h * 0.5) + (unique_bettors_last_24h * 0.3) + (recency_hours_inverse * 0.2)
```
This would require tracking per-day volume snapshots, which is more complex but more meaningful. For MVP, the recency + minimum volume approach is adequate.

#### New Endpoint: `GET /api/markets/top`

Returns the top 3 markets by total banana coin investment (regardless of recency).

```python
@router.get("/top", response_model=list[MarketResponse])
async def get_top_markets(
    limit: int = Query(3, ge=1, le=10),
    supabase: Client = Depends(get_supabase_client),
    _current_user: dict | None = Depends(get_current_user_optional),
):
    """Top markets by total coin investment volume."""
    result = (
        supabase.table("markets")
        .select("*")
        .eq("status", "open")
        .execute()
    )
    markets = result.data or []
    markets.sort(key=lambda m: m["yes_pool_total"] + m["no_pool_total"], reverse=True)

    # If fewer than 3 active, return all
    return _apply_lazy_transitions(markets[:limit], supabase)
```

### Modify: `backend/routers/leaderboard.py`

#### New Endpoint: `GET /api/leaderboard/weekly`

Returns the top users by **rolling 7-day gains** (not total balance). Falls back to monthly and then all-time if fewer than 5 users have positive gains.

```python
@router.get("/leaderboard/weekly")
async def get_weekly_leaderboard(
    limit: int = Query(10, ge=1, le=50),
    supabase: Client = Depends(get_supabase_client),
    _current_user: dict | None = Depends(get_current_user_optional),
):
    """Top users by rolling 7-day gains from bets."""
    now = datetime.now(tz=timezone.utc)
    seven_days_ago = (now - timedelta(days=7)).isoformat()
    thirty_days_ago = (now - timedelta(days=30)).isoformat()

    # Try 7-day window first
    result = _get_gains_leaderboard(supabase, seven_days_ago, limit)
    if len(result) >= 5:
        return {"period": "7d", "entries": result}

    # Fall back to 30-day
    result = _get_gains_leaderboard(supabase, thirty_days_ago, limit)
    if len(result) >= 5:
        return {"period": "30d", "entries": result}

    # Fall back to all-time
    result = _get_gains_leaderboard(supabase, None, limit)
    return {"period": "all_time", "entries": result}


def _get_gains_leaderboard(supabase, since_iso: str | None, limit: int):
    """Query net gains from payout transactions since a given date."""
    query = (
        supabase.table("transactions")
        .select("user_id, amount")
        .eq("transaction_type", "payout")
    )
    if since_iso:
        query = query.gte("created_at", since_iso)

    result = query.execute()
    txs = result.data or []

    # Aggregate gains per user
    gains = {}
    for tx in txs:
        uid = tx["user_id"]
        gains[uid] = gains.get(uid, 0) + tx["amount"]

    # Filter to positive gains only
    positive = {uid: g for uid, g in gains.items() if g > 0}

    # Get profile info for top users
    sorted_users = sorted(positive.items(), key=lambda x: x[1], reverse=True)[:limit]

    if not sorted_users:
        return []

    user_ids = [uid for uid, _ in sorted_users]
    profiles = (
        supabase.table("profiles")
        .select("id, andrew_id, display_name, banana_balance")
        .in_("id", user_ids)
        .execute()
    )
    profile_map = {p["id"]: p for p in (profiles.data or [])}

    entries = []
    for uid, gain in sorted_users:
        profile = profile_map.get(uid, {})
        entries.append({
            "id": uid,
            "andrew_id": profile.get("andrew_id", ""),
            "display_name": profile.get("display_name", ""),
            "banana_balance": profile.get("banana_balance", 0),
            "gains": round(gain, 2),
        })

    return entries
```

---

## Frontend Changes

### Rebuild: `frontend/src/app/page.tsx`

The homepage should be restructured into these sections (top to bottom):

#### Section 1: Hottest Market (Hero Display)

A large, prominent card at the top of the page.

**Layout (based on `kalshi-top-market.png`):**
- **Left side:**
  - Market title (large, bold)
  - Options with percentages:
    - For binary: "Yes — 65%", "No — 35%"
    - For multichoice: top 2-3 options with percentages
  - Total volume: "🍌 2,500 vol"
  - Description section with bold header "Description" and the market description text (truncated with "..." if long)
- **Right side:**
  - Probability chart (reuse `ProbabilityChart` component)
  - Shows the graph with percentage labels on the right axis
- **Top right corner:**
  - Pagination: "1 of 5" with left/right arrows
  - Shows up to 5 hottest markets, or fewer if fewer exist
  - Auto-advances every 8 seconds (optional, but nice for demo)
- **Clickable:** Entire card links to the market detail page

**Data source:** `GET /api/markets/hot?limit=5`

**Fallback:** If no open markets exist, show a message: "No active markets yet. Be the first to create one!"

**Implementation:**
```tsx
function HottestMarketDisplay() {
  const [hotMarkets, setHotMarkets] = useState<Market[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    api.getHotMarkets().then(setHotMarkets);
  }, []);

  if (hotMarkets.length === 0) return null;

  const market = hotMarkets[currentIndex];
  const total = hotMarkets.length;

  return (
    <div className="relative rounded-xl border bg-card p-6">
      {/* Pagination controls top-right */}
      <div className="absolute top-4 right-4 flex items-center gap-2 text-sm text-muted-foreground">
        <button onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))} disabled={currentIndex === 0}>
          ← {/* Left arrow */}
        </button>
        <span>{currentIndex + 1} of {total}</span>
        <button onClick={() => setCurrentIndex((i) => Math.min(total - 1, i + 1))} disabled={currentIndex === total - 1}>
          → {/* Right arrow */}
        </button>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Left side: title, options, volume, description */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">{market.title}</h2>
          {/* Yes/No percentages */}
          {/* Volume */}
          {/* Description */}
        </div>

        {/* Right side: chart */}
        <div>
          <ProbabilityChart data={buildPriceHistory(/* bets */)} />
        </div>
      </div>
    </div>
  );
}
```

**Do NOT include:** Live update features (as noted in features.md — "do not include a live update feature just yet").

#### Section 2: Weekly Leaderboard

A compact leaderboard showing top users by recent gains.

**Layout:**
- Header: "Weekly Leaderboard" (or "Monthly" / "All-Time" depending on fallback)
- Each row shows:
  - Rank (1st, 2nd, 3rd with trophies, then numbers)
  - User display name + andrew_id
  - **Progress bar** representing their gains relative to the leader
    - The #1 user has a full-width bar
    - Other users' bars are proportional: `width = (user_gains / leader_gains) * 100%`
  - Gains amount with BananaCoin icon
- Show at most 5-10 users
- Period label: "Past 7 days" / "Past 30 days" / "All time"

**Data source:** `GET /api/leaderboard/weekly`

**Implementation notes:**
- The bar width is calculated as: `barWidth = (entry.gains / entries[0].gains) * 100`
- Use a gradient or solid primary-colored bar
- Trophy icons for top 3 (same as existing leaderboard page)

#### Section 3: Trending & Top Markets (Tabbed)

A tabbed section with two tabs: "Trending" and "Top Markets".

**Trending tab layout (based on `kalshi-trend.png`):**
- Numbered list #1 through #3
- Each item shows:
  - **Rank number** (1, 2, 3) — bold
  - **Market title** — bold, clickable (links to market detail)
  - **Dominant choice** subtitle: the leading option and its text (e.g., "Yes" for binary markets, or the leading option label for multichoice)
  - **Percentage** — the probability of the dominant choice, shown on the right
  - **Do NOT show** trend up/down arrows (we cannot model this yet, per features.md)

**Top Markets tab:**
- Same layout and styling as Trending tab
- Ranked by total banana coin volume instead of recency
- Data source: `GET /api/markets/top`

**Tab behavior:**
- Default to "Trending" tab
- Switching tabs fetches the corresponding data
- Both tabs share the same visual component, just with different data

**Fallback:** If fewer than 3 markets qualify, show as many as exist. If zero, show "No trending markets yet."

#### Section 4: All Markets (existing, moved below)

The current market list (category filter + open/closed grids) moves below the new sections. Keep the existing functionality but add it after the new hero sections.

---

### New API Functions in `frontend/src/lib/api.ts`

```typescript
export function getHotMarkets(limit = 5): Promise<Market[]> {
  return apiFetch(`/api/markets/hot?limit=${limit}`);
}

export function getTrendingMarkets(limit = 3): Promise<Market[]> {
  return apiFetch(`/api/markets/trending?limit=${limit}`);
}

export function getTopMarkets(limit = 3): Promise<Market[]> {
  return apiFetch(`/api/markets/top?limit=${limit}`);
}

export interface WeeklyLeaderboardResponse {
  period: "7d" | "30d" | "all_time";
  entries: WeeklyLeaderboardEntry[];
}

export interface WeeklyLeaderboardEntry {
  id: string;
  andrew_id: string;
  display_name: string;
  banana_balance: number;
  gains: number;
}

export function getWeeklyLeaderboard(limit = 10): Promise<WeeklyLeaderboardResponse> {
  return apiFetch(`/api/leaderboard/weekly?limit=${limit}`);
}
```

### New Components

Create these as separate components for cleanliness:

1. **`frontend/src/components/hottest-market.tsx`** — the hero display
2. **`frontend/src/components/weekly-leaderboard.tsx`** — the gains leaderboard
3. **`frontend/src/components/trending-markets.tsx`** — the trending/top tabbed list

Each component fetches its own data on mount and handles loading/empty states.

---

## Leaderboard Calculation Details

**Rolling 7-day gains** are calculated from `transactions` where `transaction_type = 'payout'` and `created_at >= now() - 7 days`. This represents actual gains from resolved bets.

**Fallback logic:**
1. Query 7-day gains. If >= 5 users with positive gains, use this.
2. Else, query 30-day gains. If >= 5 users with positive gains, use this.
3. Else, query all-time gains (no time filter). Show whatever exists.

The "gains" number represents **net payout income**, not total balance. A user could have a high balance from initial grants + daily claims but low gains if they haven't won many bets.

---

## Testing Checklist

- [ ] Hottest market displays the market with the most coin volume
- [ ] Hottest market pagination works (1 of N, left/right arrows)
- [ ] Hottest market shows graph, percentages, volume, description
- [ ] Weekly leaderboard shows top users by rolling 7-day gains
- [ ] Leaderboard falls back to 30-day and then all-time correctly
- [ ] Progress bars are proportional to the leader's gains
- [ ] Trending tab shows recent markets with activity above threshold
- [ ] Top Markets tab shows markets ranked by total volume
- [ ] Both tabs show #1-#3 with correct Kalshi-style layout
- [ ] Empty states handled gracefully for all sections
- [ ] Existing market list still appears below the new sections
- [ ] Category filter still works on the existing market list
- [ ] All market cards link to their detail pages

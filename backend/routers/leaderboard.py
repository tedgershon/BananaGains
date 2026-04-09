from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from supabase import Client

from dependencies import get_current_user_optional, get_supabase_client
from schemas.user import LeaderboardEntry

router = APIRouter(prefix="/api", tags=["leaderboard"])


@router.get("/leaderboard", response_model=list[LeaderboardEntry])
async def get_leaderboard(
    limit: int = Query(25, ge=1, le=100),
    supabase: Client = Depends(get_supabase_client),
    _current_user: dict | None = Depends(get_current_user_optional),
):
    """Top users ranked by banana balance (descending)."""
    result = (
        supabase.table("profiles")
        .select("id, andrew_id, display_name, banana_balance")
        .order("banana_balance", desc=True)
        .limit(limit)
        .execute()
    )

    return result.data or []


def _get_gains_leaderboard(supabase: Client, since_iso: str | None, limit: int) -> list[dict]:
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

    gains: dict[str, float] = {}
    for tx in txs:
        uid = tx["user_id"]
        gains[uid] = gains.get(uid, 0) + tx["amount"]

    positive = {uid: g for uid, g in gains.items() if g > 0}
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

    result = _get_gains_leaderboard(supabase, seven_days_ago, limit)
    if len(result) >= 5:
        return {"period": "7d", "entries": result}

    result = _get_gains_leaderboard(supabase, thirty_days_ago, limit)
    if len(result) >= 5:
        return {"period": "30d", "entries": result}

    result = _get_gains_leaderboard(supabase, None, limit)
    return {"period": "all_time", "entries": result}

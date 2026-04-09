from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from supabase import Client

from dependencies import get_current_user, get_current_user_optional, get_supabase_client
from schemas.dispute import CastVoteRequest

router = APIRouter(prefix="/api/markets", tags=["resolution"])


@router.get("/resolutions")
async def list_resolution_markets(
    supabase: Client = Depends(get_supabase_client),
    _current_user: dict | None = Depends(get_current_user_optional),
):
    """List markets currently in their resolution period, sorted by expiration (soonest first)."""
    now = datetime.now(tz=timezone.utc)

    # Lazily close markets whose close_at has passed but are still marked open.
    # The DB trigger set_resolution_window fires on open→closed and sets
    # resolution_window_end = now() + 24h automatically.
    open_expired = (
        supabase.table("markets")
        .select("id")
        .eq("status", "open")
        .lte("close_at", now.isoformat())
        .execute()
    )
    if open_expired.data:
        expired_ids = [m["id"] for m in open_expired.data]
        supabase.table("markets").update({"status": "closed"}).in_(
            "id", expired_ids
        ).execute()

    result = (
        supabase.table("markets")
        .select("*")
        .in_("status", ["closed", "pending_resolution"])
        .not_.is_("resolution_window_end", "null")
        .gt("resolution_window_end", now.isoformat())
        .order("resolution_window_end", desc=False)
        .execute()
    )
    return result.data or []


@router.post("/{market_id}/community-vote")
async def cast_community_vote(
    market_id: str,
    body: CastVoteRequest,
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
        if "creator" in msg:
            raise HTTPException(403, "Market creators cannot cast community votes on their own market.")
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

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
        # The DB trigger set_resolution_window fires on open→closed and sets
        # resolution_window_end = now() + 24h, so re-querying below will pick
        # up the newly set values.

    community_result = (
        supabase.table("markets")
        .select("*")
        .eq("status", "pending_resolution")
        .is_("proposed_outcome", "null")
        .not_.is_("resolution_window_end", "null")
        .gt("resolution_window_end", now.isoformat())
        .order("resolution_window_end", desc=False)
        .execute()
    )

    disputed_result = (
        supabase.table("markets")
        .select("*")
        .eq("status", "disputed")
        .execute()
    )
    disputed_markets = disputed_result.data or []
    active_disputed: list[dict] = []
    if disputed_markets:
        market_ids = [m["id"] for m in disputed_markets]
        disputes_result = (
            supabase.table("disputes")
            .select("market_id, voting_deadline")
            .in_("market_id", market_ids)
            .execute()
        )
        deadline_by_market = {
            d["market_id"]: d["voting_deadline"] for d in (disputes_result.data or [])
        }
        for market in disputed_markets:
            deadline = deadline_by_market.get(market["id"])
            if not deadline:
                continue
            if datetime.fromisoformat(deadline) <= now:
                continue
            market["voting_ends_at"] = deadline
            active_disputed.append(market)

    active_disputed.sort(key=lambda m: m["voting_ends_at"])
    return (community_result.data or []) + active_disputed


@router.post("/{market_id}/community-vote")
async def cast_community_vote(
    market_id: str,
    body: CastVoteRequest,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client),
):
    """Cast a community resolution vote during the 24h resolution window."""
    market_result = (
        supabase.table("markets")
        .select("status, proposed_outcome")
        .eq("id", market_id)
        .single()
        .execute()
    )
    market = market_result.data
    if not market:
        raise HTTPException(404, "Market not found.")
    if market.get("status") != "pending_resolution" or market.get("proposed_outcome") is not None:
        raise HTTPException(400, "Market is not in community resolution.")

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

from fastapi import APIRouter, Depends
from supabase import Client

from dependencies import get_current_user, get_supabase_client

router = APIRouter(prefix="/api", tags=["rewards"])

TRACK_META = {
    "banana_baron": {
        "display_name": "Banana Baron",
        "description": "Grow your banana empire",
    },
    "oracle": {
        "display_name": "Oracle",
        "description": "Predict the future with accuracy",
    },
    "architect": {
        "display_name": "Architect",
        "description": "Build markets for the community",
    },
    "degen": {
        "display_name": "Degen",
        "description": "You can't stop, won't stop betting",
    },
    "whale": {
        "display_name": "Whale",
        "description": "Go big or go home",
    },
}


def _get_user_stats(supabase: Client, user_id: str) -> dict[str, float]:
    """Compute current stat values for each badge track."""
    profile = (
        supabase.table("profiles")
        .select("banana_balance")
        .eq("id", user_id)
        .single()
        .execute()
    )
    balance = float(profile.data["banana_balance"]) if profile.data else 0

    correct_bets = (
        supabase.table("bets")
        .select("id, market_id, markets!inner(status, resolved_outcome)")
        .eq("user_id", user_id)
        .eq("markets.status", "resolved")
        .execute()
    )
    correct_count = 0
    for row in correct_bets.data or []:
        market = row.get("markets", {})
        if market and row.get("side") == market.get("resolved_outcome"):
            correct_count += 1

    markets_created = (
        supabase.table("markets")
        .select("id", count="exact")
        .eq("creator_id", user_id)
        .not_.in_("status", ["pending_review", "denied"])
        .execute()
    )

    total_bets = (
        supabase.table("bets")
        .select("id", count="exact")
        .eq("user_id", user_id)
        .execute()
    )

    max_bet = (
        supabase.table("bets")
        .select("amount")
        .eq("user_id", user_id)
        .order("amount", desc=True)
        .limit(1)
        .execute()
    )
    max_single_bet = float(max_bet.data[0]["amount"]) if max_bet.data else 0

    return {
        "banana_baron": balance,
        "oracle": correct_count,
        "architect": markets_created.count or 0,
        "degen": total_bets.count or 0,
        "whale": max_single_bet,
    }


def _build_track_progress(
    definitions: list[dict],
    earned: list[dict],
    stats: dict[str, float],
) -> list[dict]:
    """Organize badge definitions into track progress objects."""
    earned_by_track = {b["track"]: b for b in earned}

    tracks_map: dict[str, list[dict]] = {}
    for d in definitions:
        tracks_map.setdefault(d["track"], []).append(d)

    result = []
    for track_key in ("banana_baron", "oracle", "architect", "degen", "whale"):
        tiers = sorted(tracks_map.get(track_key, []), key=lambda t: t["tier"])
        meta = TRACK_META.get(track_key, {"display_name": track_key, "description": ""})

        current_value = stats.get(track_key, 0)
        earned_badge = earned_by_track.get(track_key)
        current_tier = earned_badge["tier"] if earned_badge else 0

        next_threshold = None
        for t in tiers:
            if t["tier"] > current_tier:
                next_threshold = float(t["threshold"])
                break

        result.append({
            "track": track_key,
            "track_display_name": meta["display_name"],
            "track_description": meta["description"],
            "current_value": current_value,
            "next_threshold": next_threshold,
            "current_tier": current_tier,
            "max_tier": max((t["tier"] for t in tiers), default=5),
            "tiers": tiers,
        })

    return result


@router.get("/rewards")
async def get_user_rewards(
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client),
):
    """Get the user's badge progress across all tracks."""
    definitions = (
        supabase.table("badge_definitions")
        .select("*")
        .order("track")
        .order("tier")
        .execute()
    )

    earned = (
        supabase.table("user_badges")
        .select("*, badge_definitions(*)")
        .eq("user_id", current_user["id"])
        .execute()
    )

    stats = _get_user_stats(supabase, current_user["id"])

    return {
        "tracks": _build_track_progress(
            definitions.data or [],
            earned.data or [],
            stats,
        ),
        "badges": earned.data or [],
    }


@router.get("/rewards/badges/{user_id}")
async def get_user_badges(
    user_id: str,
    supabase: Client = Depends(get_supabase_client),
):
    """Get badges for any user (for leaderboard display)."""
    result = (
        supabase.table("user_badges")
        .select("*, badge_definitions(name, color, track, tier, description)")
        .eq("user_id", user_id)
        .execute()
    )
    return result.data or []


@router.post("/rewards/check")
async def check_badges(
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client),
):
    """Manually trigger badge check for current user."""
    result = supabase.rpc("check_and_award_badges", {
        "p_user_id": current_user["id"],
    }).execute()
    return {"new_badges": result.data or []}

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

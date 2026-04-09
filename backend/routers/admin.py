from fastapi import APIRouter, Depends, HTTPException, Query, status
from supabase import Client

from dependencies import get_supabase_client, require_admin, require_super_admin
from schemas.admin import (
    StatsResponse,
    UpdateRoleRequest,
    UpdateRoleResponse,
    UserSearchResult,
)

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/stats", response_model=StatsResponse)
async def get_stats(
    _current_user: dict = Depends(require_admin),
    supabase: Client = Depends(get_supabase_client),
):
    """Return cumulative platform statistics (admin only)."""
    profiles = supabase.table("profiles").select("role").execute()
    users_by_role: dict[str, int] = {}
    for row in profiles.data or []:
        r = row.get("role", "user")
        users_by_role[r] = users_by_role.get(r, 0) + 1
    total_users = sum(users_by_role.values())

    markets_data = supabase.table("markets").select("status").execute()
    markets_by_status: dict[str, int] = {}
    for row in markets_data.data or []:
        s = row.get("status", "open")
        markets_by_status[s] = markets_by_status.get(s, 0) + 1
    total_markets = sum(markets_by_status.values())

    txn_data = (
        supabase.table("transactions")
        .select("amount")
        .eq("transaction_type", "bet_placement")
        .execute()
    )
    total_banana_traded = sum(abs(row["amount"]) for row in (txn_data.data or []))

    active_statuses = ("open", "closed", "pending_resolution", "disputed")
    bets_data = (
        supabase.table("bets")
        .select("id, market_id, markets!inner(status)")
        .in_("markets.status", list(active_statuses))
        .execute()
    )
    total_active_bets = len(bets_data.data or [])

    return StatsResponse(
        total_users=total_users,
        users_by_role=users_by_role,
        total_markets=total_markets,
        markets_by_status=markets_by_status,
        total_banana_traded=total_banana_traded,
        total_active_bets=total_active_bets,
    )


@router.get("/users/search", response_model=list[UserSearchResult])
async def search_users(
    q: str = Query(..., min_length=1),
    _current_user: dict = Depends(require_super_admin),
    supabase: Client = Depends(get_supabase_client),
):
    """Search users by andrew_id (super admin only)."""
    result = (
        supabase.table("profiles")
        .select("id, andrew_id, display_name, role, created_at")
        .ilike("andrew_id", f"%{q}%")
        .limit(20)
        .execute()
    )
    return result.data or []


@router.put("/users/{user_id}/role", response_model=UpdateRoleResponse)
async def update_user_role(
    user_id: str,
    body: UpdateRoleRequest,
    current_user: dict = Depends(require_super_admin),
    supabase: Client = Depends(get_supabase_client),
):
    """Change a user's role (super admin only)."""
    if user_id == current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot change your own role.",
        )

    if body.role not in ("user", "admin"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Role must be 'user' or 'admin'.",
        )

    target = (
        supabase.table("profiles")
        .select("id")
        .eq("id", user_id)
        .single()
        .execute()
    )
    if not target.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    result = (
        supabase.table("profiles")
        .update({"role": body.role})
        .eq("id", user_id)
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update role.",
        )

    return result.data[0]

from fastapi import APIRouter, Depends, HTTPException, Query, status
from supabase import Client

from dependencies import get_supabase_client, require_admin, require_super_admin
from schemas.admin import (
    StatsResponse,
    UpdateRoleRequest,
    UpdateRoleResponse,
    UserSearchResult,
)
from schemas.market import ReviewMarketRequest

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


@router.get("/markets/review")
async def list_markets_for_review(
    _current_user: dict = Depends(require_admin),
    supabase: Client = Depends(get_supabase_client),
):
    """List all markets organized by review status."""
    pending = (
        supabase.table("markets")
        .select("*, profiles!creator_id(andrew_id, display_name)")
        .eq("status", "pending_review")
        .order("created_at", desc=False)
        .execute()
    )

    approved = (
        supabase.table("markets")
        .select("*, profiles!creator_id(andrew_id, display_name)")
        .eq("status", "open")
        .not_.is_("reviewed_by", "null")
        .order("review_date", desc=True)
        .limit(50)
        .execute()
    )

    denied = (
        supabase.table("markets")
        .select("*, profiles!creator_id(andrew_id, display_name)")
        .eq("status", "denied")
        .order("review_date", desc=True)
        .limit(50)
        .execute()
    )

    return {
        "pending": pending.data or [],
        "approved": approved.data or [],
        "denied": denied.data or [],
    }


@router.post("/markets/{market_id}/review")
async def review_market(
    market_id: str,
    body: ReviewMarketRequest,
    current_user: dict = Depends(require_admin),
    supabase: Client = Depends(get_supabase_client),
):
    """Admin reviews a proposed market — approve or deny."""
    updates = {}
    for field in ("title", "description", "resolution_criteria", "close_at", "category", "link"):
        val = getattr(body, field, None)
        if val is not None:
            updates[field] = val.isoformat() if field == "close_at" else val

    if updates:
        supabase.table("markets").update(updates).eq("id", market_id).execute()

    if body.action == "approve":
        try:
            result = supabase.rpc("approve_market", {
                "p_market_id": market_id,
                "p_admin_id": current_user["id"],
                "p_notes": body.notes,
            }).execute()
        except Exception as e:
            msg = str(e).lower()
            if "not found" in msg:
                raise HTTPException(status_code=404, detail="Market not found.")
            if "not pending" in msg:
                raise HTTPException(status_code=400, detail="Market is not pending review.")
            raise HTTPException(status_code=500, detail=f"Failed to approve market: {e}")
    else:
        try:
            result = supabase.rpc("deny_market", {
                "p_market_id": market_id,
                "p_admin_id": current_user["id"],
                "p_notes": body.notes,
            }).execute()
        except Exception as e:
            msg = str(e).lower()
            if "not found" in msg:
                raise HTTPException(status_code=404, detail="Market not found.")
            if "not pending" in msg:
                raise HTTPException(status_code=400, detail="Market is not pending review.")
            if "notes are required" in msg:
                raise HTTPException(status_code=400, detail="Notes are required when denying a market.")
            raise HTTPException(status_code=500, detail=f"Failed to deny market: {e}")

    return result.data

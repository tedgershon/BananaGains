from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client

from dependencies import get_current_user, get_supabase_client, get_user_token, user_auth
from schemas.dispute import ClaimResponse
from schemas.user import CreateProfileRequest, UpdateProfileRequest, UserProfileResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.get("/me", response_model=UserProfileResponse)
async def get_me(
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client),
):
    """Return the authenticated user's profile with daily claim status."""
    eligibility = supabase.rpc("check_claim_eligibility", {
        "p_user_id": current_user["id"]
    }).execute()

    claim_info = eligibility.data if eligibility.data else {}
    current_user["claimed_today"] = claim_info.get("claimed_today", False)
    current_user["claim_eligible"] = claim_info.get("eligible", False)
    current_user["claim_amount"] = claim_info.get("claim_amount", 0)
    current_user["above_cap"] = claim_info.get("above_cap", False)
    return current_user


@router.post(
    "/profile",
    response_model=UserProfileResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_or_update_profile(
    body: CreateProfileRequest,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client),
    token: str | None = Depends(get_user_token),
):
    """
    Upsert the profile for the authenticated user.

    Called by the frontend after first Google sign-in to set andrew_id and
    display_name.  If a profile already exists (created by the DB trigger),
    this updates it; otherwise it inserts a new row.
    """
    if not body.andrew_id.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="andrew_id must not be empty",
        )

    with user_auth(supabase, token):
        result = (
            supabase.table("profiles")
            .upsert(
                {
                    "id": current_user["id"],
                    "andrew_id": body.andrew_id.strip(),
                    "display_name": body.display_name.strip(),
                },
                on_conflict="id",
            )
            .execute()
        )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to upsert profile",
        )

    return result.data[0]


@router.patch("/profile", response_model=UserProfileResponse)
async def update_profile(
    body: UpdateProfileRequest,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client),
    token: str | None = Depends(get_user_token),
):
    """Update mutable profile fields (display_name, equipped_badge_id, avatar_url)."""
    updates: dict = {}

    if body.display_name is not None:
        name = body.display_name.strip()
        if not name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="display_name must not be empty",
            )
        updates["display_name"] = name

    if body.equipped_badge_id is not None:
        updates["equipped_badge_id"] = body.equipped_badge_id
    elif "equipped_badge_id" in (body.model_fields_set or set()):
        updates["equipped_badge_id"] = None

    if body.avatar_url is not None:
        updates["avatar_url"] = body.avatar_url
    elif "avatar_url" in (body.model_fields_set or set()):
        updates["avatar_url"] = None

    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update",
        )

    with user_auth(supabase, token):
        result = (
            supabase.table("profiles")
            .update(updates)
            .eq("id", current_user["id"])
            .execute()
        )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update profile",
        )

    return result.data[0]


@router.post("/claim-daily", response_model=ClaimResponse)
async def claim_daily_bananas(
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client),
):
    """Claim daily bananas (up to 1000, capped at 5000 balance)."""
    try:
        result = supabase.rpc("claim_daily_bananas", {
            "p_user_id": current_user["id"],
        }).execute()
        return result.data
    except Exception as e:
        msg = str(e).lower()
        if "already claimed" in msg:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Already claimed today.")
        if "cap" in msg or "above" in msg:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Balance is at or above the 5,000 coin daily claim cap.")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to claim: {e}")

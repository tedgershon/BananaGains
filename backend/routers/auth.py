from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client

from dependencies import get_current_user, get_supabase_client, get_user_token, user_auth
from schemas.dispute import ClaimResponse
from schemas.user import CreateProfileRequest, UserProfileResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.get("/me", response_model=UserProfileResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    """Return the authenticated user's profile."""
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


@router.post("/claim-daily", response_model=ClaimResponse)
async def claim_daily_bananas(
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client),
):
    """Claim 1000 bananas once per calendar day (America/New_York)."""
    try:
        result = supabase.rpc("claim_daily_bananas", {
            "p_user_id": current_user["id"],
        }).execute()
        return result.data
    except Exception as e:
        if "already claimed" in str(e).lower():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Already claimed today.")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to claim: {e}")

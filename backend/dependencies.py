from datetime import datetime, timezone

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from supabase import Client, create_client

from config import get_settings

_security = HTTPBearer(auto_error=False)
_security_optional = HTTPBearer(auto_error=False)

_supabase_client: Client | None = None

DEMO_USER_PROFILE: dict = {
    "id": "00000000-0000-0000-0000-000000000001",
    "andrew_id": "at2",
    "display_name": "Aaron Tang",
    "banana_balance": 1000,
    "created_at": datetime(2026, 3, 17, tzinfo=timezone.utc).isoformat(),
}


def get_supabase_client() -> Client | None:
    global _supabase_client
    s = get_settings()
    if s.demo_mode:
        return _supabase_client
    if _supabase_client is None:
        _supabase_client = create_client(s.supabase_url, s.supabase_key)
    return _supabase_client


def _resolve_user(token: str, supabase: Client) -> dict:
    """Validate a Supabase JWT and return the matching profile row."""
    try:
        user_response = supabase.auth.get_user(token)
        user = user_response.user
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token",
            )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        ) from exc

    profile_response = (
        supabase.table("profiles").select("*").eq("id", user.id).single().execute()
    )

    if profile_response.data is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User profile not found. Please complete onboarding.",
        )

    return profile_response.data


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_security),
    supabase: Client | None = Depends(get_supabase_client),
) -> dict:
    """Required auth -- returns the authenticated user's profile or 401.

    In demo mode, returns a hardcoded demo user profile without requiring a JWT.
    """
    if get_settings().demo_mode:
        return DEMO_USER_PROFILE

    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    if supabase is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database not configured",
        )
    return _resolve_user(credentials.credentials, supabase)


async def get_current_user_optional(
    credentials: HTTPAuthorizationCredentials | None = Depends(_security_optional),
    supabase: Client | None = Depends(get_supabase_client),
) -> dict | None:
    """Optional auth -- returns profile if a valid token is present, else None.

    In demo mode, always returns the demo user profile.
    """
    if get_settings().demo_mode:
        return DEMO_USER_PROFILE

    if credentials is None:
        return None
    if supabase is None:
        return None
    try:
        return _resolve_user(credentials.credentials, supabase)
    except HTTPException:
        return None

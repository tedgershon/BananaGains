from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from supabase import Client, create_client

from config import get_settings

_security = HTTPBearer()
_security_optional = HTTPBearer(auto_error=False)

_supabase_client: Client | None = None


def get_supabase_client() -> Client:
    global _supabase_client
    if _supabase_client is None:
        s = get_settings()
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
    credentials: HTTPAuthorizationCredentials = Depends(_security),
    supabase: Client = Depends(get_supabase_client),
) -> dict:
    """Required auth -- returns the authenticated user's profile or 401."""
    return _resolve_user(credentials.credentials, supabase)


async def get_current_user_optional(
    credentials: HTTPAuthorizationCredentials | None = Depends(_security_optional),
    supabase: Client = Depends(get_supabase_client),
) -> dict | None:
    """Optional auth -- returns profile if a valid token is present, else None."""
    if credentials is None:
        return None
    try:
        return _resolve_user(credentials.credentials, supabase)
    except HTTPException:
        return None

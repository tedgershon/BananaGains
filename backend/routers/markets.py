from fastapi import APIRouter, Depends, HTTPException, Query, status
from supabase import Client

from dependencies import get_current_user, get_current_user_optional, get_supabase_client
from schemas.market import CreateMarketRequest, MarketResponse

router = APIRouter(prefix="/api/markets", tags=["markets"])


@router.get("", response_model=list[MarketResponse])
async def list_markets(
    market_status: str | None = Query(None, alias="status"),
    category: str | None = None,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    supabase: Client = Depends(get_supabase_client),
    _current_user: dict | None = Depends(get_current_user_optional),
):
    """List markets with optional status and category filters."""
    query = supabase.table("markets").select("*")

    if market_status:
        query = query.eq("status", market_status)
    if category:
        query = query.eq("category", category)

    query = query.order("created_at", desc=True).range(offset, offset + limit - 1)
    result = query.execute()

    return result.data or []


@router.get("/{market_id}", response_model=MarketResponse)
async def get_market(
    market_id: str,
    supabase: Client = Depends(get_supabase_client),
    _current_user: dict | None = Depends(get_current_user_optional),
):
    """Get a single market by ID."""
    result = (
        supabase.table("markets").select("*").eq("id", market_id).single().execute()
    )

    if result.data is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Market not found",
        )

    return result.data


@router.post("", response_model=MarketResponse, status_code=status.HTTP_201_CREATED)
async def create_market(
    body: CreateMarketRequest,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client),
):
    """Create a new prediction market."""
    result = (
        supabase.table("markets")
        .insert(
            {
                "title": body.title,
                "description": body.description,
                "creator_id": current_user["id"],
                "close_at": body.close_at.isoformat(),
                "resolution_criteria": body.resolution_criteria,
                "category": body.category,
            }
        )
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create market",
        )

    return result.data[0]

from fastapi import APIRouter, Depends, HTTPException, Query, status
from supabase import Client

from dependencies import get_current_user, get_current_user_optional, get_supabase_client
from schemas.bet import BetResponse, PlaceBetRequest, PlaceBetResponse

router = APIRouter(prefix="/api/markets", tags=["bets"])


@router.post(
    "/{market_id}/bets",
    response_model=PlaceBetResponse,
    status_code=status.HTTP_201_CREATED,
)
async def place_bet(
    market_id: str,
    body: PlaceBetRequest,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client),
):
    """
    Place a YES or NO bet on a market.

    Uses a PostgreSQL function (place_bet) that atomically validates the
    user's balance, checks that the market is open, deducts the balance,
    updates the pool, and records both the bet and the transaction.
    """
    try:
        result = supabase.rpc(
            "place_bet",
            {
                "p_user_id": current_user["id"],
                "p_market_id": market_id,
                "p_side": body.side,
                "p_amount": body.amount,
            },
        ).execute()
    except Exception as exc:
        detail = str(exc)
        if "creators cannot place bets" in detail.lower():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You cannot bet on a market you created.",
            ) from exc
        if "Insufficient balance" in detail:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Insufficient banana balance",
            ) from exc
        if "Market is not open" in detail or "Market has closed" in detail:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Market is not open for betting",
            ) from exc
        if "not found" in detail.lower():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Market or user not found",
            ) from exc
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to place bet",
        ) from exc

    return result.data


@router.get("/{market_id}/bets", response_model=list[BetResponse])
async def list_bets_for_market(
    market_id: str,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    supabase: Client = Depends(get_supabase_client),
    _current_user: dict | None = Depends(get_current_user_optional),
):
    """List recent bets for a market (activity feed)."""
    result = (
        supabase.table("bets")
        .select("*")
        .eq("market_id", market_id)
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )

    return result.data or []

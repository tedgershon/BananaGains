from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from supabase import Client

import asyncio
import logging

from dependencies import get_current_user, get_current_user_optional, get_supabase_client, get_user_token, user_auth

logger = logging.getLogger(__name__)


def _check_badges_for_market_participants(supabase: Client, market_id: str) -> None:
    """Check badges for all users who bet on a resolved market."""
    try:
        bettors = (
            supabase.table("bets")
            .select("user_id")
            .eq("market_id", market_id)
            .execute()
        )
        user_ids = {row["user_id"] for row in (bettors.data or [])}
        for uid in user_ids:
            try:
                supabase.rpc("check_and_award_badges", {"p_user_id": uid}).execute()
            except Exception:
                logger.warning("Badge check failed for user %s", uid, exc_info=True)
    except Exception:
        logger.warning("Failed to check badges for market %s participants", market_id, exc_info=True)
from market_linter import lint_market_fields
from notification_service import notify_market_closed
from schemas.dispute import CastVoteRequest, DisputeResponse, FileDisputeRequest, VoteResponse
from schemas.market import (
    CreateMarketRequest,
    MarketResponse,
    ProposeResolutionRequest,
    ProposeResolutionResponse,
    ResolveMarketRequest,
    ResolveMarketResponse,
)

router = APIRouter(prefix="/api/markets", tags=["markets"])

DISPUTE_VOTE_QUORUM = 3
COMMUNITY_VOTE_QUORUM = 3


def _check_badges_for_market_participants(supabase: Client, market_id: str):
    """Check and award badges for all participants of a resolved market."""
    try:
        bets = supabase.table("bets").select("user_id").eq("market_id", market_id).execute()
        user_ids = {b["user_id"] for b in (bets.data or [])}
        market = supabase.table("markets").select("creator_id").eq("id", market_id).single().execute()
        if market.data:
            user_ids.add(market.data["creator_id"])
        for uid in user_ids:
            try:
                supabase.rpc("check_and_award_badges", {"p_user_id": uid}).execute()
            except Exception:
                pass
    except Exception:
        pass


def _apply_lazy_transitions(markets: list[dict], supabase: Client) -> list[dict]:
    """Lazily apply deadline-based state transitions when markets are fetched."""
    now = datetime.now(tz=timezone.utc)
    close_ids: list[str] = []
    finalize_markets: list[dict] = []
    tally_markets: list[dict] = []

    for m in markets:
        s = m.get("status")

        if s in ("pending_review", "denied"):
            continue

        # open -> closed (existing logic)
        if s == "open":
            close_at = datetime.fromisoformat(m["close_at"])
            if close_at <= now:
                m["status"] = "closed"
                close_ids.append(m["id"])

        # pending_resolution -> resolved (dispute window expired, no dispute filed)
        elif s == "pending_resolution" and m.get("dispute_deadline"):
            deadline = datetime.fromisoformat(m["dispute_deadline"])
            if deadline <= now:
                finalize_markets.append(m)

        # disputed -> resolved or admin_review (voting deadline expired)
        elif s == "disputed":
            tally_markets.append(m)

    # Batch close expired open markets
    if close_ids:
        close_result = supabase.table("markets").update({"status": "closed"}).in_("id", close_ids).execute()

        # The DB trigger set_resolution_window sets resolution_window_end on
        # the row, but our in-memory dicts still have the old null value.
        # Sync them from the update response so the frontend sees the window.
        updated_map = {row["id"]: row for row in (close_result.data or [])}
        for m in markets:
            if m["id"] in updated_map:
                m["resolution_window_end"] = updated_map[m["id"]].get("resolution_window_end")

        for m in markets:
            if m["id"] in close_ids:
                try:
                    loop = asyncio.get_event_loop()
                    if loop.is_running():
                        loop.create_task(notify_market_closed(supabase, m))
                    else:
                        loop.run_until_complete(notify_market_closed(supabase, m))
                except RuntimeError:
                    asyncio.run(notify_market_closed(supabase, m))

    # Auto-finalize markets whose dispute window expired with no dispute
    for m in finalize_markets:
        try:
            supabase.rpc("finalize_resolution", {
                "p_market_id": m["id"],
                "p_outcome": m["proposed_outcome"],
            }).execute()
            m["status"] = "resolved"
            m["resolved_outcome"] = m["proposed_outcome"]
            _check_badges_for_market_participants(supabase, m["id"])
        except Exception:
            pass  # Already resolved or state changed concurrently

    # Tally votes for disputed markets whose voting deadline has passed
    for m in tally_markets:
        dispute = (
            supabase.table("disputes")
            .select("id, voting_deadline")
            .eq("market_id", m["id"])
            .single()
            .execute()
        )
        if not dispute.data:
            continue

        deadline = datetime.fromisoformat(dispute.data["voting_deadline"])
        if deadline > now:
            continue  # Voting still open

        # Count votes
        votes = (
            supabase.table("resolution_votes")
            .select("selected_outcome")
            .eq("dispute_id", dispute.data["id"])
            .execute()
        )
        yes_count = sum(1 for v in (votes.data or []) if v["selected_outcome"] == "YES")
        no_count = sum(1 for v in (votes.data or []) if v["selected_outcome"] == "NO")
        total = yes_count + no_count

        if total >= DISPUTE_VOTE_QUORUM and yes_count != no_count:
            # Decisive vote — finalize with the winning outcome
            winning = "YES" if yes_count > no_count else "NO"
            try:
                supabase.rpc("finalize_resolution", {
                    "p_market_id": m["id"],
                    "p_outcome": winning,
                }).execute()
                m["status"] = "resolved"
                m["resolved_outcome"] = winning
                _check_badges_for_market_participants(supabase, m["id"])
            except Exception:
                pass
        else:
            # Tie, low quorum — escalate to admin
            supabase.table("markets").update({"status": "admin_review"}).eq("id", m["id"]).execute()
            m["status"] = "admin_review"

    # Auto-finalize explicit community-resolution markets whose window expired
    for m in markets:
        if (
            m.get("status") == "pending_resolution"
            and not m.get("proposed_outcome")
            and m.get("resolution_window_end")
        ):
            window_end = datetime.fromisoformat(m["resolution_window_end"])
            if window_end > now:
                continue
            if m["status"] in ("resolved", "admin_review"):
                continue

            votes = (
                supabase.table("community_votes")
                .select("selected_outcome")
                .eq("market_id", m["id"])
                .execute()
            )
            yes_votes = sum(1 for v in (votes.data or []) if v["selected_outcome"] == "YES")
            no_votes = sum(1 for v in (votes.data or []) if v["selected_outcome"] == "NO")
            total_votes = yes_votes + no_votes

            if total_votes >= COMMUNITY_VOTE_QUORUM and yes_votes != no_votes:
                winning = "YES" if yes_votes > no_votes else "NO"
                try:
                    supabase.rpc("finalize_resolution", {
                        "p_market_id": m["id"],
                        "p_outcome": winning,
                    }).execute()
                    m["status"] = "resolved"
                    m["resolved_outcome"] = winning

                    supabase.rpc("distribute_voter_rewards", {
                        "p_market_id": m["id"],
                        "p_winning_outcome": winning,
                    }).execute()
                    _check_badges_for_market_participants(supabase, m["id"])
                except Exception:
                    pass
            else:
                supabase.table("markets").update({"status": "admin_review"}).eq("id", m["id"]).execute()
                m["status"] = "admin_review"

    return markets


# ── Market CRUD ──────────────────────────────────────────────


def _attach_options(markets: list[dict], supabase: Client) -> list[dict]:
    """For multichoice markets, fetch and attach their options."""
    mc_ids = [m["id"] for m in markets if m.get("market_type") == "multichoice"]
    if not mc_ids:
        return markets

    options_result = (
        supabase.table("market_options")
        .select("*")
        .in_("market_id", mc_ids)
        .order("sort_order")
        .execute()
    )
    options_by_market: dict[str, list[dict]] = {}
    for opt in options_result.data or []:
        options_by_market.setdefault(opt["market_id"], []).append(opt)

    for m in markets:
        if m.get("market_type") == "multichoice":
            m["options"] = options_by_market.get(m["id"], [])

    return markets


@router.get("", response_model=list[MarketResponse])
async def list_markets(
    market_status: str | None = Query(None, alias="status"),
    category: str | None = None,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    supabase: Client = Depends(get_supabase_client),
    _current_user: dict | None = Depends(get_current_user_optional),
):
    query = supabase.table("markets").select("*")

    if market_status:
        query = query.eq("status", market_status)
    else:
        query = query.not_.in_("status", ["pending_review", "denied"])
    if category:
        query = query.eq("category", category)

    query = query.order("created_at", desc=True).range(offset, offset + limit - 1)
    result = query.execute()

    markets = _apply_lazy_transitions(result.data or [], supabase)
    return _attach_options(markets, supabase)


TRENDING_MIN_VOLUME = 100
TRENDING_RECENCY_DAYS = 7


@router.get("/hot", response_model=list[MarketResponse])
async def get_hot_markets(
    limit: int = Query(5, ge=1, le=10),
    supabase: Client = Depends(get_supabase_client),
    _current_user: dict | None = Depends(get_current_user_optional),
):
    """Top markets by total coin volume (yes_pool + no_pool)."""
    result = (
        supabase.table("markets")
        .select("*")
        .eq("status", "open")
        .execute()
    )
    markets = result.data or []
    markets.sort(key=lambda m: m["yes_pool_total"] + m["no_pool_total"], reverse=True)
    transitioned = _apply_lazy_transitions(markets[:limit], supabase)
    return _attach_options(transitioned, supabase)


@router.get("/trending", response_model=list[MarketResponse])
async def get_trending_markets(
    limit: int = Query(3, ge=1, le=10),
    supabase: Client = Depends(get_supabase_client),
    _current_user: dict | None = Depends(get_current_user_optional),
):
    """Trending markets: recently created + minimum activity threshold."""
    cutoff = (datetime.now(tz=timezone.utc) - timedelta(days=TRENDING_RECENCY_DAYS)).isoformat()

    result = (
        supabase.table("markets")
        .select("*")
        .eq("status", "open")
        .gte("created_at", cutoff)
        .execute()
    )
    markets = result.data or []

    qualified = [m for m in markets if (m["yes_pool_total"] + m["no_pool_total"]) >= TRENDING_MIN_VOLUME]
    qualified.sort(key=lambda m: (m["created_at"], m["yes_pool_total"] + m["no_pool_total"]), reverse=True)

    if len(qualified) < limit:
        remaining = [m for m in markets if m not in qualified]
        remaining.sort(key=lambda m: m["created_at"], reverse=True)
        qualified.extend(remaining[:limit - len(qualified)])

    transitioned = _apply_lazy_transitions(qualified[:limit], supabase)
    return _attach_options(transitioned, supabase)


@router.get("/top", response_model=list[MarketResponse])
async def get_top_markets(
    limit: int = Query(3, ge=1, le=10),
    supabase: Client = Depends(get_supabase_client),
    _current_user: dict | None = Depends(get_current_user_optional),
):
    """Top markets by total coin investment volume."""
    result = (
        supabase.table("markets")
        .select("*")
        .eq("status", "open")
        .execute()
    )
    markets = result.data or []
    markets.sort(key=lambda m: m["yes_pool_total"] + m["no_pool_total"], reverse=True)
    transitioned = _apply_lazy_transitions(markets[:limit], supabase)
    return _attach_options(transitioned, supabase)


@router.get("/{market_id}", response_model=MarketResponse)
async def get_market(
    market_id: str,
    supabase: Client = Depends(get_supabase_client),
    _current_user: dict | None = Depends(get_current_user_optional),
):
    result = (
        supabase.table("markets").select("*").eq("id", market_id).single().execute()
    )

    if result.data is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Market not found")

    markets = _apply_lazy_transitions([result.data], supabase)
    return _attach_options(markets, supabase)[0]


@router.post("", response_model=MarketResponse, status_code=status.HTTP_201_CREATED)
async def create_market(
    body: CreateMarketRequest,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client),
    token: str | None = Depends(get_user_token),
):
    linted = lint_market_fields(body)

    market_row = {
        "title": linted.title,
        "description": linted.description,
        "creator_id": current_user["id"],
        "close_at": linted.close_at.isoformat(),
        "resolution_criteria": linted.resolution_criteria,
        "category": linted.category,
        "official_source": linted.official_source,
        "yes_criteria": linted.yes_criteria,
        "no_criteria": linted.no_criteria,
        "ambiguity_criteria": linted.ambiguity_criteria,
        "link": linted.link,
        "status": "pending_review",
        "market_type": linted.market_type,
    }

    if linted.market_type == "multichoice":
        market_row["multichoice_type"] = linted.multichoice_type

    with user_auth(supabase, token):
        result = supabase.table("markets").insert(market_row).execute()

        if not result.data:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create market")

        market = result.data[0]

        if linted.market_type == "multichoice" and linted.options:
            option_rows = [
                {
                    "market_id": market["id"],
                    "label": label,
                    "sort_order": idx,
                }
                for idx, label in enumerate(linted.options)
            ]
            options_result = supabase.table("market_options").insert(option_rows).execute()
            market["options"] = options_result.data or []

    return market


# ── Resolution Flow ──────────────────────────────────────────


@router.post("/{market_id}/resolve", response_model=ProposeResolutionResponse)
async def propose_resolution(
    market_id: str,
    body: ProposeResolutionRequest,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client),
    token: str | None = Depends(get_user_token),
):
    """Creator proposes an outcome. Starts 24h dispute window — no payout yet."""
    with user_auth(supabase, token):
        try:
            result = supabase.rpc("propose_resolution", {
                "p_market_id": market_id,
                "p_outcome": body.outcome,
                "p_proposer_id": current_user["id"],
            }).execute()
            return result.data
        except Exception as e:
            msg = str(e).lower()
            if "not found" in msg:
                raise HTTPException(status_code=404, detail="Market not found.")
            if "creator" in msg:
                raise HTTPException(status_code=403, detail="Only the market creator can propose a resolution.")
            if "closed" in msg:
                raise HTTPException(status_code=400, detail="Market must be closed before proposing resolution.")
            raise HTTPException(status_code=500, detail=f"Failed to propose resolution: {e}")


@router.post("/{market_id}/community-resolution", response_model=MarketResponse)
async def start_community_resolution(
    market_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client),
    token: str | None = Depends(get_user_token),
):
    """Creator starts the 24h community-resolution flow on a just-closed market."""
    with user_auth(supabase, token):
        market_result = (
            supabase.table("markets")
            .select("*")
            .eq("id", market_id)
            .single()
            .execute()
        )
        market = market_result.data
        if not market:
            raise HTTPException(status_code=404, detail="Market not found.")

        if market.get("creator_id") != current_user.get("id"):
            raise HTTPException(status_code=403, detail="Only the market creator can start community resolution.")

        # Handle lazy-transition race: UI may already show "closed" while the
        # stored row is still "open" but expired.
        if market.get("status") == "open":
            close_at = datetime.fromisoformat(market["close_at"])
            if close_at <= datetime.now(tz=timezone.utc):
                closed = (
                    supabase.table("markets")
                    .update({"status": "closed"})
                    .eq("id", market_id)
                    .execute()
                )
                if closed.data:
                    market = closed.data[0]

        if market.get("status") == "pending_resolution" and not market.get("proposed_outcome"):
            return market

        if market.get("status") != "closed":
            raise HTTPException(
                status_code=400,
                detail="Community resolution can only be started for closed markets.",
            )

        update_payload: dict[str, str | None] = {
            "status": "pending_resolution",
            "proposed_outcome": None,
            "proposed_at": None,
            "dispute_deadline": None,
            "resolution_window_end": (
                datetime.now(tz=timezone.utc) + timedelta(hours=24)
            ).isoformat(),
        }

        updated = (
            supabase.table("markets")
            .update(update_payload)
            .eq("id", market_id)
            .execute()
        )
        if not updated.data:
            raise HTTPException(status_code=500, detail="Failed to start community resolution.")
        return updated.data[0]


# ── Disputes ─────────────────────────────────────────────────


@router.post("/{market_id}/dispute", response_model=DisputeResponse)
async def file_dispute(
    market_id: str,
    body: FileDisputeRequest,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client),
    token: str | None = Depends(get_user_token),
):
    """File a dispute during the pending_resolution window."""
    with user_auth(supabase, token):
        try:
            result = supabase.rpc("file_dispute", {
                "p_market_id": market_id,
                "p_disputer_id": current_user["id"],
                "p_explanation": body.explanation,
            }).execute()
            return result.data
        except Exception as e:
            msg = str(e).lower()
            if "not found" in msg:
                raise HTTPException(status_code=404, detail="Market not found.")
            if "pending_resolution" in msg:
                raise HTTPException(status_code=400, detail="Market is not in pending resolution.")
            if "expired" in msg:
                raise HTTPException(status_code=400, detail="Dispute window has expired.")
            if "unique" in msg or "duplicate" in msg:
                raise HTTPException(status_code=409, detail="A dispute already exists for this market.")
            raise HTTPException(status_code=500, detail=f"Failed to file dispute: {e}")


@router.get("/{market_id}/dispute", response_model=DisputeResponse)
async def get_dispute(
    market_id: str,
    supabase: Client = Depends(get_supabase_client),
    _current_user: dict | None = Depends(get_current_user_optional),
):
    """Get the active dispute for a market."""
    result = (
        supabase.table("disputes").select("*").eq("market_id", market_id).single().execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="No dispute found for this market.")
    return result.data


@router.post("/{market_id}/dispute/vote", response_model=VoteResponse)
async def cast_vote(
    market_id: str,
    body: CastVoteRequest,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client),
    token: str | None = Depends(get_user_token),
):
    """Cast a vote on a dispute. Only neutral users (not creator, not bettors) can vote."""
    # Look up the dispute for this market
    dispute = (
        supabase.table("disputes").select("id").eq("market_id", market_id).single().execute()
    )
    if not dispute.data:
        raise HTTPException(status_code=404, detail="No dispute found for this market.")

    with user_auth(supabase, token):
        try:
            result = supabase.rpc("cast_dispute_vote", {
                "p_dispute_id": dispute.data["id"],
                "p_voter_id": current_user["id"],
                "p_vote": body.vote,
            }).execute()
            return result.data
        except Exception as e:
            msg = str(e).lower()
            if "creator" in msg:
                raise HTTPException(status_code=403, detail="Market creator cannot vote on disputes.")
            if "bets" in msg or "bettor" in msg:
                raise HTTPException(status_code=403, detail="Users who placed bets cannot vote on disputes.")
            if "expired" in msg:
                raise HTTPException(status_code=400, detail="Voting window has expired.")
            if "unique" in msg or "duplicate" in msg:
                raise HTTPException(status_code=409, detail="You have already voted on this dispute.")
            raise HTTPException(status_code=500, detail=f"Failed to cast vote: {e}")


@router.get("/{market_id}/dispute/votes", response_model=list[VoteResponse])
async def list_votes(
    market_id: str,
    supabase: Client = Depends(get_supabase_client),
    _current_user: dict | None = Depends(get_current_user_optional),
):
    """List all votes on a market's dispute."""
    dispute = (
        supabase.table("disputes").select("id").eq("market_id", market_id).single().execute()
    )
    if not dispute.data:
        raise HTTPException(status_code=404, detail="No dispute found for this market.")

    result = (
        supabase.table("resolution_votes")
        .select("*")
        .eq("dispute_id", dispute.data["id"])
        .order("created_at", desc=False)
        .execute()
    )
    return result.data or []


# ── Admin ────────────────────────────────────────────────────


@router.post("/admin/{market_id}/resolve", response_model=ResolveMarketResponse)
async def admin_resolve(
    market_id: str,
    body: ResolveMarketRequest,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_client),
    token: str | None = Depends(get_user_token),
):
    """Admin makes the final resolution call on an admin_review market."""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required.")

    with user_auth(supabase, token):
        try:
            result = supabase.rpc("admin_resolve_market", {
                "p_market_id": market_id,
                "p_outcome": body.outcome,
                "p_admin_id": current_user["id"],
            }).execute()
            return result.data
        except Exception as e:
            msg = str(e).lower()
            if "not found" in msg:
                raise HTTPException(status_code=404, detail="Market not found.")
            if "admin_review" in msg:
                raise HTTPException(status_code=400, detail="Market is not in admin review.")
            raise HTTPException(status_code=500, detail=f"Failed to resolve market: {e}")

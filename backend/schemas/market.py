from datetime import datetime
from enum import Enum
from typing import Literal

from pydantic import BaseModel, field_validator


class MarketStatus(str, Enum):
    PENDING_REVIEW = "pending_review"
    OPEN = "open"
    CLOSED = "closed"
    PENDING_RESOLUTION = "pending_resolution"
    DISPUTED = "disputed"
    ADMIN_REVIEW = "admin_review"
    RESOLVED = "resolved"
    DENIED = "denied"


class CreateMarketRequest(BaseModel):
    title: str
    description: str
    close_at: datetime
    resolution_criteria: str
    category: str = "General"
    official_source: str
    yes_criteria: str
    no_criteria: str
    ambiguity_criteria: str
    link: str | None = None

    @field_validator("title", "official_source", "yes_criteria", "no_criteria", "ambiguity_criteria")
    @classmethod
    def not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Field must not be empty")
        return v.strip()

    @field_validator("close_at")
    @classmethod
    def close_at_in_future(cls, v: datetime) -> datetime:
        if v <= datetime.now(tz=v.tzinfo):
            raise ValueError("close_at must be in the future")
        return v

    @field_validator("link")
    @classmethod
    def validate_link(cls, v: str | None) -> str | None:
        if v is None or v.strip() == "":
            return None
        v = v.strip()
        import re
        url_pattern = r"^https?://[^\s/$.?#].[^\s]*$"
        if not re.match(url_pattern, v):
            raise ValueError("Invalid URL format. Must start with http:// or https://")
        return v


class MarketResponse(BaseModel):
    id: str
    title: str
    description: str
    creator_id: str
    created_at: datetime
    close_at: datetime
    status: MarketStatus
    resolution_criteria: str
    category: str
    yes_pool_total: float
    no_pool_total: float
    official_source: str | None = None
    yes_criteria: str | None = None
    no_criteria: str | None = None
    ambiguity_criteria: str | None = None
    proposed_outcome: Literal["YES", "NO"] | None = None
    proposed_at: datetime | None = None
    dispute_deadline: datetime | None = None
    resolved_outcome: Literal["YES", "NO"] | None = None
    resolved_at: datetime | None = None
    disputed_at: datetime | None = None
    disputed_by: str | None = None
    voting_ends_at: datetime | None = None
    link: str | None = None
    reviewed_by: str | None = None
    review_date: datetime | None = None
    review_notes: str | None = None


class ReviewMarketRequest(BaseModel):
    action: Literal["approve", "deny"]
    notes: str | None = None
    title: str | None = None
    description: str | None = None
    resolution_criteria: str | None = None
    close_at: datetime | None = None
    category: str | None = None
    link: str | None = None

    @field_validator("notes")
    @classmethod
    def notes_required_for_deny(cls, v, info):
        if info.data.get("action") == "deny" and (v is None or v.strip() == ""):
            raise ValueError("Notes are required when denying a market")
        return v


class ProposeResolutionRequest(BaseModel):
    outcome: Literal["YES", "NO"]


class ProposeResolutionResponse(BaseModel):
    market_id: str
    status: str
    proposed_outcome: str
    dispute_deadline: datetime


class ResolveMarketRequest(BaseModel):
    outcome: Literal["YES", "NO"]


class ResolveMarketResponse(BaseModel):
    market_id: str
    status: str
    outcome: str


class DisputeMarketResponse(BaseModel):
    market_id: str
    status: str
    voting_ends_at: datetime | None = None


class ResolutionVoteRequest(BaseModel):
    outcome: Literal["YES", "NO"]
    amount: float

    @field_validator("amount")
    @classmethod
    def amount_positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Stake amount must be positive")
        return v


class ResolutionVoteResponse(BaseModel):
    vote_id: str
    new_balance: float


class ResolutionTotalsResponse(BaseModel):
    yes_total: float
    no_total: float
    total_staked: float
    total_voters: int


class FinalizeDisputeResponse(BaseModel):
    market_id: str
    status: str
    outcome: str
    yes_total: float
    no_total: float
    total_voters: int


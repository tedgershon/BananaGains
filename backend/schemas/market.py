from datetime import datetime
from enum import Enum
from typing import Literal

from pydantic import BaseModel, field_validator


class MarketStatus(str, Enum):
    OPEN = "open"
    CLOSED = "closed"
    PENDING_RESOLUTION = "pending_resolution"
    DISPUTED = "disputed"
    ADMIN_REVIEW = "admin_review"
    RESOLVED = "resolved"


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


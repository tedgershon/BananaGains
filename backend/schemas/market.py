from datetime import datetime
from enum import Enum
from typing import Literal

from pydantic import BaseModel, field_validator


class MarketStatus(str, Enum):
    OPEN = "open"
    CLOSED = "closed"
    RESOLVED = "resolved"
    DISPUTED = "disputed"


class CreateMarketRequest(BaseModel):
    title: str
    description: str
    close_at: datetime
    resolution_criteria: str
    category: str = "General"

    @field_validator("title")
    @classmethod
    def title_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Title must not be empty")
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
    resolved_outcome: Literal["YES", "NO"] | None = None
    resolved_at: datetime | None = None

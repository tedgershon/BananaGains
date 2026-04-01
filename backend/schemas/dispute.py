from datetime import datetime
from typing import Literal

from pydantic import BaseModel, field_validator


class FileDisputeRequest(BaseModel):
    explanation: str

    @field_validator("explanation")
    @classmethod
    def explanation_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Explanation must not be empty")
        if len(v) > 1000:
            raise ValueError("Explanation must be 1000 characters or fewer")
        return v


class DisputeResponse(BaseModel):
    id: str
    market_id: str
    disputer_id: str
    explanation: str
    voting_deadline: datetime
    resolved_by_admin: bool
    created_at: datetime


class CastVoteRequest(BaseModel):
    vote: Literal["YES", "NO"]


class VoteResponse(BaseModel):
    id: str
    dispute_id: str
    market_id: str
    voter_id: str
    selected_outcome: str
    created_at: datetime


class ClaimResponse(BaseModel):
    new_balance: float
    claimed_at: datetime

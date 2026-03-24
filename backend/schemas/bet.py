from datetime import datetime
from typing import Literal

from pydantic import BaseModel, field_validator


class PlaceBetRequest(BaseModel):
    side: Literal["YES", "NO"]
    amount: float

    @field_validator("amount")
    @classmethod
    def amount_positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Bet amount must be positive")
        return v


class BetResponse(BaseModel):
    id: str
    user_id: str
    market_id: str
    side: Literal["YES", "NO"]
    amount: float
    created_at: datetime


class PlaceBetResponse(BaseModel):
    bet_id: str
    new_balance: float

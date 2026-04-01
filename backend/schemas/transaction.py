from datetime import datetime
from enum import Enum

from pydantic import BaseModel


class TransactionType(str, Enum):
    INITIAL_GRANT = "initial_grant"
    BET_PLACEMENT = "bet_placement"
    PAYOUT = "payout"
    VOTER_STAKE = "voter_stake"
    VOTER_REWARD = "voter_reward"
    DAILY_CLAIM = "daily_claim"


class TransactionResponse(BaseModel):
    id: str
    user_id: str
    market_id: str | None = None
    transaction_type: TransactionType
    amount: float
    created_at: datetime

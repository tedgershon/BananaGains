from datetime import datetime

from pydantic import BaseModel


class UserProfileResponse(BaseModel):
    id: str
    andrew_id: str
    display_name: str
    banana_balance: float
    created_at: datetime
    claimed_today: bool = False
    role: str = "user"
    is_admin: bool = False


class CreateProfileRequest(BaseModel):
    andrew_id: str
    display_name: str


class LeaderboardEntry(BaseModel):
    id: str
    andrew_id: str
    display_name: str
    banana_balance: float

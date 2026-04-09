from pydantic import BaseModel


class StatsResponse(BaseModel):
    total_users: int
    users_by_role: dict[str, int]
    total_markets: int
    markets_by_status: dict[str, int]
    total_banana_traded: float
    total_active_bets: int


class UserSearchResult(BaseModel):
    id: str
    andrew_id: str
    display_name: str
    role: str
    created_at: str


class UpdateRoleRequest(BaseModel):
    role: str


class UpdateRoleResponse(BaseModel):
    id: str
    andrew_id: str
    display_name: str
    role: str

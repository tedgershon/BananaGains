from datetime import datetime

from pydantic import BaseModel


class BadgeDefinitionResponse(BaseModel):
    id: str
    track: str
    tier: int
    name: str
    description: str
    threshold: float
    color: str


class UserBadgeResponse(BaseModel):
    id: str
    user_id: str
    badge_id: str
    track: str
    tier: int
    earned_at: datetime
    badge_definitions: BadgeDefinitionResponse | None = None


class TrackProgress(BaseModel):
    track: str
    track_display_name: str
    track_description: str
    current_value: float
    next_threshold: float | None
    current_tier: int
    max_tier: int
    tiers: list[BadgeDefinitionResponse]


class RewardsResponse(BaseModel):
    tracks: list[TrackProgress]
    badges: list[UserBadgeResponse]


class CheckBadgesResponse(BaseModel):
    new_badges: list[dict]

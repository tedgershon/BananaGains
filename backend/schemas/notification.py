from datetime import datetime

from pydantic import BaseModel


class NotificationResponse(BaseModel):
    id: str
    user_id: str
    type: str
    title: str
    body: str
    metadata: dict = {}
    is_read: bool
    created_at: datetime


class UnreadCountResponse(BaseModel):
    count: int

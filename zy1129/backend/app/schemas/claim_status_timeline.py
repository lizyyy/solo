from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class ClaimStatusTimelineResponse(BaseModel):
    id: int
    claim_id: int
    status: str
    changed_at: datetime
    description: Optional[str] = None
    operator: Optional[str] = None

    class Config:
        from_attributes = True

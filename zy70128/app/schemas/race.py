from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field
from app.schemas.base import BaseResponse


class RaceCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    race_date: datetime
    is_published: bool = False


class RaceUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    race_date: Optional[datetime] = None
    is_published: Optional[bool] = None


class RaceResponse(BaseResponse):
    name: str
    description: Optional[str]
    race_date: datetime
    is_published: bool

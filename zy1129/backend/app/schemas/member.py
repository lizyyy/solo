from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime


class MemberBase(BaseModel):
    name: str
    relationship: str
    birth_date: Optional[date] = None
    gender: Optional[str] = None
    notes: Optional[str] = None


class MemberCreate(MemberBase):
    pass


class MemberUpdate(MemberBase):
    name: Optional[str] = None
    relationship: Optional[str] = None


class MemberResponse(MemberBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

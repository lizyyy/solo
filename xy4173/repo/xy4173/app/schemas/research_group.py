from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class ResearchGroupBase(BaseModel):
    group_code: str = Field(..., min_length=1, max_length=50)
    name: str = Field(..., min_length=1, max_length=100)
    principal_investigator: Optional[str] = None
    department: Optional[str] = None
    contact_email: Optional[str] = None
    is_active: bool = True


class ResearchGroupCreate(ResearchGroupBase):
    pass


class ResearchGroupUpdate(BaseModel):
    name: Optional[str] = None
    principal_investigator: Optional[str] = None
    department: Optional[str] = None
    contact_email: Optional[str] = None
    is_active: Optional[bool] = None


class ResearchGroupResponse(ResearchGroupBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

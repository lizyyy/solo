from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field
from app.schemas.base import BaseResponse


class AppealCreate(BaseModel):
    race_id: int
    athlete_id: Optional[str] = None
    athlete_name: Optional[str] = None
    bib_number: Optional[str] = None
    appeal_type: Optional[str] = None
    description: str
    supporting_documents: Optional[str] = None
    submitted_by: str
    submitted_at: Optional[datetime] = None
    priority: str = "MEDIUM"


class AppealUpdate(BaseModel):
    assigned_to: Optional[str] = None
    description: Optional[str] = None
    supporting_documents: Optional[str] = None
    priority: Optional[str] = None
    deadline: Optional[datetime] = None


class AppealStatusUpdate(BaseModel):
    status: str
    resolution_notes: Optional[str] = None
    resolved_by: Optional[str] = None


class AppealResponse(BaseResponse):
    race_id: int
    appeal_number: str
    athlete_id: Optional[str]
    athlete_name: Optional[str]
    bib_number: Optional[str]
    status: str
    appeal_type: Optional[str]
    description: str
    supporting_documents: Optional[str]
    submitted_by: str
    submitted_at: datetime
    assigned_to: Optional[str]
    priority: str
    deadline: Optional[datetime]
    resolution_notes: Optional[str]
    resolved_at: Optional[datetime]
    resolved_by: Optional[str]

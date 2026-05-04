from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime


class IncidentBase(BaseModel):
    incident_number: str
    incident_type: str
    incident_date: date
    report_date: Optional[date] = None
    affected_member_id: Optional[int] = None
    description: str
    location: Optional[str] = None
    severity: str = "moderate"
    status: str = "pending"
    notes: Optional[str] = None


class IncidentCreate(IncidentBase):
    pass


class IncidentUpdate(IncidentBase):
    incident_number: Optional[str] = None
    incident_type: Optional[str] = None
    incident_date: Optional[date] = None
    description: Optional[str] = None


class IncidentResponse(IncidentBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

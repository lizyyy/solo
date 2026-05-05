from datetime import datetime
from typing import Optional, List
from enum import Enum
from pydantic import BaseModel, Field


class TreeStatus(str, Enum):
    OPEN = "开放"
    CLOSED = "封闭"
    NEEDS_REINFORCEMENT = "需加固"
    NEEDS_REVIEW = "需复查"


class TreeRecord(BaseModel):
    id: str
    name: str
    location: str
    age: int
    species: str
    status: str = "正常"
    last_inspection: Optional[datetime] = None
    notes: Optional[str] = None


class PatrolRecord(BaseModel):
    id: str
    tree_id: str
    inspector: str
    date: datetime
    photos: List[str] = Field(default_factory=list)
    notes: str
    issues_found: List[str] = Field(default_factory=list)


class WeatherAlert(BaseModel):
    id: str
    date: datetime
    alert_type: str
    severity: str
    affected_areas: List[str]
    description: str


class PruningOrder(BaseModel):
    id: str
    tree_id: str
    order_date: datetime
    scheduled_date: datetime
    status: str
    reason: str
    assigned_to: str


class Complaint(BaseModel):
    id: str
    tree_id: str
    date: datetime
    reporter: str
    complaint_type: str
    description: str
    status: str = "待处理"


class TreeAssessment(BaseModel):
    tree_id: str
    assessment_date: datetime
    status: TreeStatus
    reasons: List[str]
    patrol_records: List[str] = Field(default_factory=list)
    weather_alerts: List[str] = Field(default_factory=list)
    pruning_orders: List[str] = Field(default_factory=list)
    complaints: List[str] = Field(default_factory=list)


class ReviewRecord(BaseModel):
    id: str
    tree_id: str
    assessment_id: str
    review_date: datetime
    reviewer: str
    original_status: TreeStatus
    final_status: TreeStatus
    review_notes: str

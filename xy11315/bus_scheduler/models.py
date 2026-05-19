from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class Role(str, Enum):
    DISPATCHER = "dispatcher"
    DRIVER = "driver"
    PARENT = "parent"
    ADMIN = "admin"
    AUDITOR = "auditor"


class AppealStatus(str, Enum):
    PENDING = "pending"
    MATCHED = "matched"
    RULED = "ruled"
    REVIEWED = "reviewed"
    REJECTED = "rejected"


class RulingResult(str, Enum):
    DRIVER_FAULT = "driver_fault"
    TRAFFIC_DELAY = "traffic_delay"
    ROUTE_CHANGE = "route_change"
    PARENT_MISTAKE = "parent_mistake"
    GPS_ERROR = "gps_error"
    NO_FAULT = "no_fault"


class AuditLog(BaseModel):
    id: str
    entity_type: str
    entity_id: str
    action: str
    operator: str
    operator_role: Role
    timestamp: datetime = Field(default_factory=datetime.now)
    details: Dict[str, Any] = Field(default_factory=dict)


class GPSPoint(BaseModel):
    timestamp: datetime
    latitude: float
    longitude: float
    accuracy: Optional[float] = None


class BusRoute(BaseModel):
    route_id: str
    route_name: str
    stops: List[str]
    scheduled_times: Dict[str, datetime]


class DriverCheckin(BaseModel):
    checkin_id: str
    driver_id: str
    driver_name: str
    bus_id: str
    route_id: str
    checkin_time: datetime
    location: Optional[str] = None
    status: str = "checked_in"


class ParentAppeal(BaseModel):
    appeal_id: str
    parent_id: str
    parent_name: str
    student_name: str
    bus_id: str
    route_id: str
    stop_name: str
    scheduled_time: datetime
    actual_arrival_time: Optional[datetime] = None
    appeal_time: datetime
    description: str
    status: AppealStatus = AppealStatus.PENDING
    created_at: datetime = Field(default_factory=datetime.now)
    created_by: str
    created_by_role: Role


class GpsTrack(BaseModel):
    track_id: str
    bus_id: str
    route_id: str
    date: str
    points: List[GPSPoint]
    gaps: List[Dict[str, Any]] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.now)
    created_by: str
    created_by_role: Role


class MatchedCase(BaseModel):
    case_id: str
    appeal_id: str
    gps_track_id: Optional[str] = None
    driver_checkin_id: Optional[str] = None
    bus_id: str
    route_id: str
    stop_name: str
    matched_at: datetime = Field(default_factory=datetime.now)
    matched_by: str
    matched_by_role: Role
    issues: List[str] = Field(default_factory=list)


class RulingDecision(BaseModel):
    ruling_id: str
    case_id: str
    appeal_id: str
    result: RulingResult
    reason: str
    details: Dict[str, Any] = Field(default_factory=dict)
    ruled_at: datetime = Field(default_factory=datetime.now)
    ruled_by: str
    ruled_by_role: Role


class ReviewDecision(BaseModel):
    review_id: str
    case_id: str
    appeal_id: str
    original_ruling_id: str
    uphold: bool
    new_result: Optional[RulingResult] = None
    reason: str
    reviewed_at: datetime = Field(default_factory=datetime.now)
    reviewed_by: str
    reviewed_by_role: Role


class BatchOperationResult(BaseModel):
    operation: str
    total_count: int
    success_count: int
    failure_count: int
    successful_ids: List[str] = Field(default_factory=list)
    failed_ids: List[str] = Field(default_factory=list)
    errors: Dict[str, str] = Field(default_factory=dict)
    timestamp: datetime = Field(default_factory=datetime.now)
    operator: str

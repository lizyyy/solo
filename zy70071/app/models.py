from datetime import datetime
from enum import Enum
from typing import Optional, List
from pydantic import BaseModel, Field


class VisitorStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    CHECKED_IN = "checked_in"
    CHECKED_OUT = "checked_out"
    CANCELLED = "cancelled"
    RESCHEDULED = "rescheduled"


class PermissionStatus(str, Enum):
    PENDING = "pending"
    ISSUED = "issued"
    REVOKED = "revoked"
    FAILED = "failed"


class ParkingStatus(str, Enum):
    PENDING = "pending"
    ASSIGNED = "assigned"
    RELEASED = "released"
    FAILED = "failed"


class AnomalyType(str, Enum):
    RESCHEDULE_MISMATCH = "reschedule_mismatch"
    PERMISSION_REVOKE_FAILED = "permission_revoke_failed"
    PARKING_RELEASE_FAILED = "parking_release_failed"
    INVALID_CHECKIN = "invalid_checkin"
    INVALID_CHECKOUT = "invalid_checkout"
    STATUS_INCONSISTENCY = "status_inconsistency"


class VisitorCreate(BaseModel):
    visitor_name: str
    visitor_phone: str
    visitor_company: str
    host_name: str
    host_department: str
    scheduled_start_time: datetime
    scheduled_end_time: datetime
    purpose: str
    needs_parking: bool = False
    car_plate: Optional[str] = None
    access_areas: List[str]


class VisitorUpdate(BaseModel):
    scheduled_start_time: Optional[datetime] = None
    scheduled_end_time: Optional[datetime] = None
    access_areas: Optional[List[str]] = None
    needs_parking: Optional[bool] = None
    car_plate: Optional[str] = None


class VisitorResponse(BaseModel):
    id: str
    status: VisitorStatus
    visitor_name: str
    visitor_phone: str
    visitor_company: str
    host_name: str
    host_department: str
    scheduled_start_time: datetime
    scheduled_end_time: datetime
    actual_checkin_time: Optional[datetime] = None
    actual_checkout_time: Optional[datetime] = None
    purpose: str
    needs_parking: bool
    car_plate: Optional[str] = None
    access_areas: List[str]
    permission_id: Optional[str] = None
    parking_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class Permission(BaseModel):
    id: str
    visitor_id: str
    status: PermissionStatus
    access_areas: List[str]
    issued_at: Optional[datetime] = None
    revoked_at: Optional[datetime] = None
    error_message: Optional[str] = None


class ParkingSpot(BaseModel):
    id: str
    visitor_id: str
    spot_number: str
    status: ParkingStatus
    car_plate: Optional[str] = None
    assigned_at: Optional[datetime] = None
    released_at: Optional[datetime] = None
    error_message: Optional[str] = None


class AnomalyRecord(BaseModel):
    id: str
    visitor_id: str
    anomaly_type: AnomalyType
    description: str
    details: dict
    created_at: datetime
    resolved: bool = False
    resolved_at: Optional[datetime] = None


class AuditLog(BaseModel):
    id: str
    visitor_id: str
    action: str
    actor: str
    previous_state: Optional[dict] = None
    new_state: Optional[dict] = None
    timestamp: datetime
    comment: Optional[str] = None

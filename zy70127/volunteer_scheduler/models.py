from dataclasses import dataclass, field, asdict
from datetime import datetime, date
from enum import Enum
from typing import Optional, List, Dict, Any
import uuid
import json


class LeaveStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    CANCELED = "canceled"


class CheckInPermission(str, Enum):
    GRANTED = "granted"
    REVOKED = "revoked"
    PENDING_REVIEW = "pending_review"


class ScheduleStatus(str, Enum):
    ACTIVE = "active"
    REPLACED = "replaced"
    CANCELED = "canceled"


class EventType(str, Enum):
    LEAVE_REQUEST_CREATED = "leave_request_created"
    LEAVE_APPROVED = "leave_approved"
    LEAVE_REJECTED = "leave_rejected"
    SUBSTITUTION_FOUND = "substitution_found"
    SUBSTITUTION_FAILED = "substitution_failed"
    CHECKIN_PERMISSION_UPDATED = "checkin_permission_updated"
    GAP_DETECTED = "gap_detected"
    GAP_RESOLVED = "gap_resolved"
    SCHEDULE_EXPORTED = "schedule_exported"
    MANUAL_CORRECTION = "manual_correction"
    ROLLBACK_EXECUTED = "rollback_executed"


@dataclass
class PositionRequirement:
    position_id: str
    name: str
    required_qualifications: List[str]
    required_count: int
    date: date
    time_slot: str
    description: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data["date"] = self.date.isoformat()
        return data


@dataclass
class Volunteer:
    volunteer_id: str
    name: str
    qualifications: List[str]
    phone: Optional[str] = None
    email: Optional[str] = None
    is_active: bool = True

    def has_qualification(self, qualification: str) -> bool:
        return qualification in self.qualifications

    def matches_requirements(self, required_qualifications: List[str]) -> bool:
        if not required_qualifications:
            return True
        return all(self.has_qualification(q) for q in required_qualifications)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class Schedule:
    schedule_id: str
    position_id: str
    volunteer_id: str
    date: date
    time_slot: str
    checkin_permission: CheckInPermission = CheckInPermission.GRANTED
    status: ScheduleStatus = ScheduleStatus.ACTIVE
    notes: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data["date"] = self.date.isoformat()
        data["created_at"] = self.created_at.isoformat()
        data["updated_at"] = self.updated_at.isoformat()
        return data


@dataclass
class LeaveRequest:
    leave_id: str
    volunteer_id: str
    schedule_id: str
    date: date
    time_slot: str
    reason: str
    status: LeaveStatus = LeaveStatus.PENDING
    created_at: datetime = field(default_factory=datetime.now)
    processed_at: Optional[datetime] = None
    processed_by: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data["date"] = self.date.isoformat()
        data["created_at"] = self.created_at.isoformat()
        data["processed_at"] = self.processed_at.isoformat() if self.processed_at else None
        return data


@dataclass
class SubstitutionRecord:
    substitution_id: str
    leave_request_id: str
    original_schedule_id: str
    new_schedule_id: str
    original_volunteer_id: str
    substitute_volunteer_id: str
    position_id: str
    date: date
    time_slot: str
    created_at: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data["date"] = self.date.isoformat()
        data["created_at"] = self.created_at.isoformat()
        return data


@dataclass
class EventLog:
    event_id: str
    event_type: EventType
    timestamp: datetime
    entity_id: str
    entity_type: str
    details: Dict[str, Any]
    success: bool
    error_message: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data["timestamp"] = self.timestamp.isoformat()
        return data


def generate_id() -> str:
    return str(uuid.uuid4())


def parse_date(date_str: str) -> date:
    return datetime.strptime(date_str, "%Y-%m-%d").date()


def parse_datetime(dt_str: str) -> datetime:
    return datetime.fromisoformat(dt_str)

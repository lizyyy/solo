from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Optional, List, Dict, Any
from uuid import UUID


class LockStatus(Enum):
    ACTIVE = "ACTIVE"
    RELEASED = "RELEASED"
    EXPIRED = "EXPIRED"
    CONVERTED = "CONVERTED"
    CONFLICT = "CONFLICT"


class SeatStatus(Enum):
    AVAILABLE = "AVAILABLE"
    LOCKED = "LOCKED"
    SOLD = "SOLD"
    RESERVED = "RESERVED"
    BLOCKED = "BLOCKED"


class ChangeStatus(Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    EXECUTED = "EXECUTED"
    FAILED = "FAILED"
    TIMEOUT = "TIMEOUT"


class DataSource(Enum):
    ORDER_SYSTEM = "ORDER_SYSTEM"
    BOX_OFFICE = "BOX_OFFICE"
    MOBILE_APP = "MOBILE_APP"
    WEB_PORTAL = "WEB_PORTAL"
    API_GATEWAY = "API_GATEWAY"
    BATCH_IMPORT = "BATCH_IMPORT"


class IssueType(Enum):
    TIMEOUT_UNRELEASED = "TIMEOUT_UNRELEASED"
    SEAT_CONFLICT = "SEAT_CONFLICT"
    INVALID_CHANGE = "INVALID_CHANGE"
    OVERLAPPING_WINDOW = "OVERLAPPING_WINDOW"
    GROUP_MISMATCH = "GROUP_MISMATCH"
    BAD_DATA = "BAD_DATA"


@dataclass
class SourceTrace:
    source_file: str
    line_number: int
    raw_content: str
    parsed_at: datetime = field(default_factory=datetime.now)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "source_file": self.source_file,
            "line_number": self.line_number,
            "raw_content": self.raw_content,
            "parsed_at": self.parsed_at.isoformat()
        }


@dataclass
class BadRecord:
    source_trace: SourceTrace
    error_message: str
    error_type: str
    corrected: bool = False
    correction_note: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "source_trace": self.source_trace.to_dict(),
            "error_message": self.error_message,
            "error_type": self.error_type,
            "corrected": self.corrected,
            "correction_note": self.correction_note
        }


@dataclass
class Show:
    show_id: str
    title: str
    venue: str
    show_time: datetime
    total_seats: int
    is_active: bool = True
    
    source_trace: Optional[SourceTrace] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "show_id": self.show_id,
            "title": self.title,
            "venue": self.venue,
            "show_time": self.show_time.isoformat(),
            "total_seats": self.total_seats,
            "is_active": self.is_active
        }


@dataclass
class Seat:
    seat_id: str
    show_id: str
    section: str
    row: str
    number: str
    seat_type: str = "NORMAL"
    status: SeatStatus = SeatStatus.AVAILABLE
    price: float = 0.0
    
    source_trace: Optional[SourceTrace] = None
    
    @property
    def full_seat_code(self) -> str:
        return f"{self.section}-{self.row}-{self.number}"
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "seat_id": self.seat_id,
            "show_id": self.show_id,
            "section": self.section,
            "row": self.row,
            "number": self.number,
            "full_seat_code": self.full_seat_code,
            "seat_type": self.seat_type,
            "status": self.status.value,
            "price": self.price
        }


@dataclass
class GroupOrder:
    order_id: str
    group_name: str
    show_id: str
    contact_name: str
    contact_phone: str
    total_tickets: int
    created_at: datetime
    is_active: bool = True
    
    source_trace: Optional[SourceTrace] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "order_id": self.order_id,
            "group_name": self.group_name,
            "show_id": self.show_id,
            "contact_name": self.contact_name,
            "contact_phone": self.contact_phone,
            "total_tickets": self.total_tickets,
            "created_at": self.created_at.isoformat(),
            "is_active": self.is_active
        }


@dataclass
class HoldWindow:
    window_id: str
    show_id: str
    order_id: str
    seat_ids: List[str]
    hold_start: datetime
    hold_end: datetime
    hold_reason: str = "GROUP_HOLD"
    created_by: str = "SYSTEM"
    
    source_trace: Optional[SourceTrace] = None
    
    @property
    def duration(self) -> timedelta:
        return self.hold_end - self.hold_start
    
    @property
    def is_expired(self) -> bool:
        return datetime.now() > self.hold_end
    
    @property
    def remaining_minutes(self) -> int:
        if self.is_expired:
            return 0
        return int((self.hold_end - datetime.now()).total_seconds() / 60)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "window_id": self.window_id,
            "show_id": self.show_id,
            "order_id": self.order_id,
            "seat_ids": self.seat_ids,
            "hold_start": self.hold_start.isoformat(),
            "hold_end": self.hold_end.isoformat(),
            "hold_reason": self.hold_reason,
            "created_by": self.created_by,
            "duration_minutes": int(self.duration.total_seconds() / 60),
            "is_expired": self.is_expired,
            "remaining_minutes": self.remaining_minutes
        }


@dataclass
class SeatLock:
    lock_id: str
    show_id: str
    seat_id: str
    order_id: str
    window_id: str
    locked_at: datetime
    lock_timeout: datetime
    status: LockStatus = LockStatus.ACTIVE
    locked_by: str = "SYSTEM"
    released_at: Optional[datetime] = None
    released_by: Optional[str] = None
    release_reason: Optional[str] = None
    
    source_trace: Optional[SourceTrace] = None
    
    @property
    def is_timeout(self) -> bool:
        return datetime.now() > self.lock_timeout and self.status == LockStatus.ACTIVE
    
    @property
    def remaining_lock_minutes(self) -> int:
        if datetime.now() > self.lock_timeout:
            return 0
        return int((self.lock_timeout - datetime.now()).total_seconds() / 60)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "lock_id": self.lock_id,
            "show_id": self.show_id,
            "seat_id": self.seat_id,
            "order_id": self.order_id,
            "window_id": self.window_id,
            "locked_at": self.locked_at.isoformat(),
            "lock_timeout": self.lock_timeout.isoformat(),
            "status": self.status.value,
            "locked_by": self.locked_by,
            "released_at": self.released_at.isoformat() if self.released_at else None,
            "released_by": self.released_by,
            "release_reason": self.release_reason,
            "is_timeout": self.is_timeout,
            "remaining_lock_minutes": self.remaining_lock_minutes
        }


@dataclass
class SeatChangeRequest:
    change_id: str
    show_id: str
    order_id: str
    from_seat_ids: List[str]
    to_seat_ids: List[str]
    requested_at: datetime
    requested_by: str
    status: ChangeStatus = ChangeStatus.PENDING
    approved_at: Optional[datetime] = None
    approved_by: Optional[str] = None
    executed_at: Optional[datetime] = None
    reject_reason: Optional[str] = None
    
    source_trace: Optional[SourceTrace] = None
    
    @property
    def seat_count_match(self) -> bool:
        return len(self.from_seat_ids) == len(self.to_seat_ids)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "change_id": self.change_id,
            "show_id": self.show_id,
            "order_id": self.order_id,
            "from_seat_ids": self.from_seat_ids,
            "to_seat_ids": self.to_seat_ids,
            "requested_at": self.requested_at.isoformat(),
            "requested_by": self.requested_by,
            "status": self.status.value,
            "seat_count_match": self.seat_count_match,
            "approved_at": self.approved_at.isoformat() if self.approved_at else None,
            "approved_by": self.approved_by,
            "executed_at": self.executed_at.isoformat() if self.executed_at else None,
            "reject_reason": self.reject_reason
        }


@dataclass
class Issue:
    issue_id: str
    issue_type: IssueType
    show_id: str
    severity: str
    description: str
    related_ids: Dict[str, List[str]] = field(default_factory=dict)
    discovered_at: datetime = field(default_factory=datetime.now)
    resolved: bool = False
    resolved_at: Optional[datetime] = None
    resolution_note: Optional[str] = None
    
    source_trace: Optional[SourceTrace] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "issue_id": self.issue_id,
            "issue_type": self.issue_type.value,
            "show_id": self.show_id,
            "severity": self.severity,
            "description": self.description,
            "related_ids": self.related_ids,
            "resolved": self.resolved,
            "resolved_at": self.resolved_at.isoformat() if self.resolved_at else None,
            "resolution_note": self.resolution_note
        }


@dataclass
class RunState:
    run_id: str
    started_at: datetime
    completed_at: Optional[datetime] = None
    status: str = "RUNNING"
    input_files: List[str] = field(default_factory=list)
    records_processed: int = 0
    records_skipped: int = 0
    issues_found: int = 0
    error_message: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "run_id": self.run_id,
            "started_at": self.started_at.isoformat(),
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "status": self.status,
            "input_files": self.input_files,
            "records_processed": self.records_processed,
            "records_skipped": self.records_skipped,
            "issues_found": self.issues_found,
            "error_message": self.error_message
        }

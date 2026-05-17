from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import List, Optional, Dict
import uuid


class ReaderType(Enum):
    TEACHER = "teacher"
    STUDENT = "student"
    STAFF = "staff"


class ReservationStatus(Enum):
    PENDING = "pending"
    LOCKED = "locked"
    PICKED_UP = "picked_up"
    EXPIRED = "expired"
    CANCELLED = "cancelled"


class CopyStatus(Enum):
    AVAILABLE = "available"
    RESERVED = "reserved"
    LENT = "lent"
    PROCESSING = "processing"


@dataclass
class Reader:
    reader_id: str
    name: str
    reader_type: ReaderType
    department: str
    overdue_count: int = 0

    def get_priority(self) -> int:
        priority_map = {
            ReaderType.TEACHER: 100,
            ReaderType.STAFF: 50,
            ReaderType.STUDENT: 10
        }
        return priority_map.get(self.reader_type, 0)


@dataclass
class BookCopy:
    copy_id: str
    isbn: str
    title: str
    status: CopyStatus
    location: str
    current_reservation_id: Optional[str] = None


@dataclass
class PickupWindow:
    window_id: str
    start_time: datetime
    end_time: datetime
    location: str
    max_capacity: int = 10


@dataclass
class Reservation:
    reservation_id: str
    reader_id: str
    copy_id: str
    status: ReservationStatus
    created_at: datetime
    pickup_window_id: Optional[str] = None
    locked_until: Optional[datetime] = None
    picked_up_at: Optional[datetime] = None
    expired_at: Optional[datetime] = None
    queue_position: int = 0

    def is_locked(self) -> bool:
        if self.locked_until and self.status == ReservationStatus.LOCKED:
            return datetime.now() < self.locked_until
        return False

    def is_expired(self) -> bool:
        if self.status == ReservationStatus.EXPIRED:
            return True
        if self.locked_until and datetime.now() > self.locked_until:
            return True
        return False


@dataclass
class OverdueRecord:
    record_id: str
    reservation_id: str
    reader_id: str
    copy_id: str
    expired_at: datetime
    created_at: datetime = field(default_factory=datetime.now)


@dataclass
class FlowReport:
    report_id: str
    generated_at: datetime
    total_reservations: int
    processed_reservations: int
    expired_reservations: int
    picked_up_reservations: int
    teacher_priority_count: int
    released_copies: List[str]
    queue_changes: List[Dict]

    def to_dict(self) -> Dict:
        return {
            "report_id": self.report_id,
            "generated_at": self.generated_at.isoformat(),
            "total_reservations": self.total_reservations,
            "processed_reservations": self.processed_reservations,
            "expired_reservations": self.expired_reservations,
            "picked_up_reservations": self.picked_up_reservations,
            "teacher_priority_count": self.teacher_priority_count,
            "released_copies": self.released_copies,
            "queue_changes": self.queue_changes
        }

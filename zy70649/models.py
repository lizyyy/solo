from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Optional, List
from enum import Enum


class BookingStatus(Enum):
    CONFIRMED = "confirmed"
    PENDING = "pending"
    CANCELLED = "cancelled"
    BLOCKED = "blocked"


class LockReason(Enum):
    BOOKING = "booking"
    MAINTENANCE = "maintenance"
    OWNER_USE = "owner_use"
    OTHER = "other"


@dataclass(order=True)
class SourceLocation:
    file_path: str = field(compare=True)
    line_number: Optional[int] = field(default=None, compare=True)
    sheet_name: Optional[str] = field(default=None, compare=True)
    raw_content: str = field(default="", compare=False)

    def __str__(self) -> str:
        if self.line_number:
            return f"{self.file_path}:{self.line_number}"
        return self.file_path


@dataclass(order=True)
class BookingInterval:
    room_id: str = field(compare=True)
    room_name: str = field(compare=True)
    checkin_date: date = field(compare=True)
    checkout_date: date = field(compare=True)
    guest_name: str = field(default="", compare=False)
    status: BookingStatus = field(default=BookingStatus.CONFIRMED, compare=False)
    lock_reason: LockReason = field(default=LockReason.BOOKING, compare=False)
    platform: str = field(default="", compare=False)
    booking_id: str = field(default="", compare=False)
    source: SourceLocation = field(default=None, compare=False)
    notes: str = field(default="", compare=False)
    is_merged: bool = field(default=False, compare=False)
    merged_from: List["BookingInterval"] = field(default_factory=list, compare=False)

    @property
    def nights(self) -> int:
        return (self.checkout_date - self.checkin_date).days

    @property
    def date_range_str(self) -> str:
        return f"{self.checkin_date.isoformat()} ~ {self.checkout_date.isoformat()}"

    def overlaps_with(self, other: "BookingInterval") -> bool:
        if self.room_id != other.room_id:
            return False
        return not (
            self.checkout_date <= other.checkin_date
            or self.checkin_date >= other.checkout_date
        )

    def contains_date(self, d: date) -> bool:
        return self.checkin_date <= d < self.checkout_date

    def can_merge_with(self, other: "BookingInterval") -> bool:
        if self.room_id != other.room_id:
            return False
        if self.guest_name and other.guest_name and self.guest_name != other.guest_name:
            return False
        if self.status != other.status:
            return False
        if self.lock_reason != other.lock_reason:
            return False
        return (
            self.checkout_date == other.checkin_date
            or other.checkout_date == self.checkin_date
        )

    def merge_with(self, other: "BookingInterval") -> "BookingInterval":
        new_checkin = min(self.checkin_date, other.checkin_date)
        new_checkout = max(self.checkout_date, other.checkout_date)
        merged = BookingInterval(
            room_id=self.room_id,
            room_name=self.room_name,
            checkin_date=new_checkin,
            checkout_date=new_checkout,
            guest_name=self.guest_name or other.guest_name,
            status=self.status,
            lock_reason=self.lock_reason,
            platform=f"{self.platform},{other.platform}",
            booking_id=f"{self.booking_id},{other.booking_id}",
            source=self.source,
            is_merged=True,
            merged_from=[self, other],
        )
        return merged


@dataclass
class Conflict:
    conflict_type: str
    room_id: str
    room_name: str
    date: Optional[date]
    intervals: List[BookingInterval]
    description: str

    def to_dict(self):
        return {
            "conflict_type": self.conflict_type,
            "room_id": self.room_id,
            "room_name": self.room_name,
            "date": self.date.isoformat() if self.date else None,
            "description": self.description,
            "intervals_count": len(self.intervals),
            "intervals": [
                {
                    "date_range": i.date_range_str,
                    "guest": i.guest_name,
                    "platform": i.platform,
                    "source": str(i.source),
                    "booking_id": i.booking_id,
                }
                for i in self.intervals
            ],
        }


@dataclass
class ParseError:
    source: SourceLocation
    error_type: str
    message: str
    raw_data: dict = field(default_factory=dict)

    def to_dict(self):
        return {
            "source": str(self.source),
            "error_type": self.error_type,
            "message": self.message,
            "raw_content": self.source.raw_content,
        }

from dataclasses import dataclass, field, asdict
from typing import List, Optional
from datetime import datetime
import json
import uuid
from enum import Enum


class MemberLevel(Enum):
    DIAMOND = "钻石会员"
    GOLD = "金卡会员"
    SILVER = "银卡会员"
    NORMAL = "普通会员"

    @classmethod
    def from_str(cls, s: str) -> "MemberLevel":
        mapping = {
            "钻石会员": cls.DIAMOND,
            "金卡会员": cls.GOLD,
            "银卡会员": cls.SILVER,
            "普通会员": cls.NORMAL,
        }
        return mapping.get(s, cls.NORMAL)

    @property
    def priority(self) -> int:
        priorities = {
            MemberLevel.DIAMOND: 4,
            MemberLevel.GOLD: 3,
            MemberLevel.SILVER: 2,
            MemberLevel.NORMAL: 1,
        }
        return priorities[self]


class RegistrationStatus(Enum):
    CONFIRMED = "已确认"
    WAITLIST = "候补"
    NOTIFIED = "已通知待确认"
    CANCELLED = "已取消"
    PROMOTED = "已转正"
    PROCESSED = "已处理"


@dataclass
class Course:
    id: str
    name: str
    category: str
    instructor: str
    max_capacity: int
    date: str
    time: str
    location: str

    @classmethod
    def from_dict(cls, d: dict) -> "Course":
        return cls(
            id=d["id"],
            name=d["name"],
            category=d["category"],
            instructor=d["instructor"],
            max_capacity=int(d["max_capacity"]),
            date=d["date"],
            time=d["time"],
            location=d["location"],
        )

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class Registration:
    id: str
    course_id: str
    name: str
    phone: str
    member_level: MemberLevel
    registration_time: datetime
    status: RegistrationStatus
    is_notified: bool = False
    confirmed_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None
    promoted_from: Optional[str] = None
    process_batch_id: Optional[str] = None
    notes: str = ""

    @classmethod
    def from_dict(cls, d: dict) -> "Registration":
        return cls(
            id=d["id"],
            course_id=d["course_id"],
            name=d["name"],
            phone=d["phone"],
            member_level=MemberLevel.from_str(d["member_level"]),
            registration_time=datetime.fromisoformat(d["registration_time"]),
            status=RegistrationStatus(d["status"]),
            is_notified=d.get("is_notified", False),
            confirmed_at=datetime.fromisoformat(d["confirmed_at"]) if d.get("confirmed_at") else None,
            cancelled_at=datetime.fromisoformat(d["cancelled_at"]) if d.get("cancelled_at") else None,
            promoted_from=d.get("promoted_from"),
            process_batch_id=d.get("process_batch_id"),
            notes=d.get("notes", ""),
        )

    def to_dict(self) -> dict:
        d = asdict(self)
        d["member_level"] = self.member_level.value
        d["status"] = self.status.value
        d["registration_time"] = self.registration_time.isoformat()
        if self.confirmed_at:
            d["confirmed_at"] = self.confirmed_at.isoformat()
        if self.cancelled_at:
            d["cancelled_at"] = self.cancelled_at.isoformat()
        return d

    @property
    def sort_key(self) -> tuple:
        return (-self.member_level.priority, self.registration_time)

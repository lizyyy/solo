import json
import hashlib
from dataclasses import dataclass, field, asdict
from datetime import datetime, date, time
from typing import Optional, Dict, List, Any
from enum import Enum


class AttendanceStatus(Enum):
    PRESENT = "present"
    LATE = "late"
    EARLY_LEAVE = "early_leave"
    ABSENT = "absent"
    UNKNOWN = "unknown"


class SourceType(Enum):
    QR_CODE = "qr_code"
    PAPER = "paper"
    MAKEUP = "makeup"
    MANUAL = "manual"


class MakeupStatus(Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


@dataclass
class Student:
    id: str
    name: str
    phone: str
    department: str = ""
    active: bool = True
    created_at: str = ""
    updated_at: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Student":
        return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})


@dataclass
class Course:
    id: str
    name: str
    instructor: str
    start_date: str
    end_date: str
    start_time: str
    end_time: str
    total_hours: float
    created_at: str = ""
    updated_at: str = ""

    @property
    def is_multi_day(self) -> bool:
        return self.start_date != self.end_date

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Course":
        return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})


@dataclass
class AttendanceRecord:
    id: str
    course_id: str
    student_id: str
    source: str
    source_detail: str = ""
    signin_time: Optional[str] = None
    signout_time: Optional[str] = None
    status: str = AttendanceStatus.UNKNOWN.value
    is_valid: bool = True
    validation_errors: List[str] = field(default_factory=list)
    makeup_application_id: Optional[str] = None
    created_at: str = ""
    updated_at: str = ""
    import_id: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "AttendanceRecord":
        return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})


@dataclass
class MakeupApplication:
    id: str
    course_id: str
    student_id: str
    reason: str
    submitted_by: str
    submitted_at: str
    status: str = MakeupStatus.PENDING.value
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[str] = None
    review_comment: Optional[str] = None
    created_at: str = ""
    updated_at: str = ""
    import_id: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "MakeupApplication":
        return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})


@dataclass
class AuditLog:
    id: str
    action: str
    entity_type: str
    entity_id: str
    before: Optional[Dict[str, Any]] = None
    after: Optional[Dict[str, Any]] = None
    operator: str = "system"
    timestamp: str = ""
    reason: str = ""
    detail: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "AuditLog":
        return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})


@dataclass
class ImportSession:
    id: str
    source_type: str
    file_name: str
    timestamp: str
    status: str
    message: str
    records_processed: int = 0
    records_skipped: int = 0
    records_failed: int = 0
    import_ids: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ImportSession":
        return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})


def generate_id(*parts: str) -> str:
    content = "-".join(parts) + "-" + datetime.now().isoformat()
    return hashlib.md5(content.encode()).hexdigest()[:16]


def now_str() -> str:
    return datetime.now().isoformat(timespec="seconds")

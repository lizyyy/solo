from dataclasses import dataclass, field, asdict
from datetime import date, datetime
from enum import Enum
from typing import Optional, Dict, Any, List
import json


class DisputeType(Enum):
    OVERTIME = "overtime"
    NO_TASK = "no_task"
    UNACCEPTED = "unaccepted"
    DUPLICATE = "duplicate"
    REJECTED = "rejected"


class DisputeStatus(Enum):
    OPEN = "open"
    RESOLVED = "resolved"
    WAIVED = "waived"
    PENDING = "pending"


@dataclass
class Employee:
    employee_id: str
    name: str
    hourly_rate: float = 100.0

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Employee":
        return cls(**data)


@dataclass
class Task:
    task_id: str
    title: str
    status: str
    estimated_hours: Optional[float] = None
    max_daily_hours: Optional[float] = 8.0

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Task":
        return cls(**data)


@dataclass
class Acceptance:
    task_id: str
    accepted: bool
    accepted_date: Optional[date] = None
    rejection_reason: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        if self.accepted_date:
            d["accepted_date"] = self.accepted_date.isoformat()
        return d

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Acceptance":
        if "accepted_date" in data and data["accepted_date"]:
            data = data.copy()
            data["accepted_date"] = date.fromisoformat(data["accepted_date"])
        return cls(**data)


@dataclass
class WorkLog:
    log_id: str
    employee_id: str
    task_id: str
    work_date: date
    hours: float
    description: str = ""
    source_hash: str = ""
    created_at: datetime = field(default_factory=datetime.now)
    is_active: bool = True

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["work_date"] = self.work_date.isoformat()
        d["created_at"] = self.created_at.isoformat()
        return d

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "WorkLog":
        data = data.copy()
        if "work_date" in data and isinstance(data["work_date"], str):
            data["work_date"] = date.fromisoformat(data["work_date"])
        if "created_at" in data and isinstance(data["created_at"], str):
            data["created_at"] = datetime.fromisoformat(data["created_at"])
        return cls(**data)


@dataclass
class Dispute:
    dispute_id: str
    log_id: str
    dispute_type: DisputeType
    status: DisputeStatus = DisputeStatus.OPEN
    original_hours: float = 0.0
    adjusted_hours: Optional[float] = None
    notes: List[str] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)
    resolved_at: Optional[datetime] = None

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["dispute_type"] = self.dispute_type.value
        d["status"] = self.status.value
        d["created_at"] = self.created_at.isoformat()
        if self.resolved_at:
            d["resolved_at"] = self.resolved_at.isoformat()
        return d

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Dispute":
        data = data.copy()
        if "dispute_type" in data:
            data["dispute_type"] = DisputeType(data["dispute_type"])
        if "status" in data:
            data["status"] = DisputeStatus(data["status"])
        if "created_at" in data and isinstance(data["created_at"], str):
            data["created_at"] = datetime.fromisoformat(data["created_at"])
        if "resolved_at" in data and data["resolved_at"]:
            data["resolved_at"] = datetime.fromisoformat(data["resolved_at"])
        return cls(**data)


@dataclass
class AdjustmentHistory:
    history_id: str
    log_id: str
    before_hours: float
    after_hours: float
    reason: str
    created_at: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["created_at"] = self.created_at.isoformat()
        return d

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "AdjustmentHistory":
        data = data.copy()
        if "created_at" in data and isinstance(data["created_at"], str):
            data["created_at"] = datetime.fromisoformat(data["created_at"])
        return cls(**data)

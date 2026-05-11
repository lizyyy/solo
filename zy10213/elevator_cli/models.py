"""数据模型定义"""
from dataclasses import dataclass, asdict, field
from datetime import date, datetime
from typing import Optional, List
import uuid
import json


def generate_id() -> str:
    return uuid.uuid4().hex[:12]


def date_to_str(d: Optional[date]) -> Optional[str]:
    return d.isoformat() if d else None


def str_to_date(s: Optional[str]) -> Optional[date]:
    if not s:
        return None
    if isinstance(s, date):
        return s
    return datetime.strptime(s, "%Y-%m-%d").date()


def now_date() -> date:
    return date.today()


@dataclass
class Building:
    """楼栋"""
    id: str = field(default_factory=generate_id)
    name: str = ""
    floors: int = 0

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: dict) -> "Building":
        return cls(
            id=d.get("id", generate_id()),
            name=d.get("name", ""),
            floors=d.get("floors", 0)
        )


@dataclass
class Elevator:
    """电梯"""
    id: str = field(default_factory=generate_id)
    building_id: str = ""
    code: str = ""
    last_maintenance_date: Optional[date] = None
    maintenance_cycle_days: int = 30
    created_at: date = field(default_factory=now_date)

    def to_dict(self) -> dict:
        d = asdict(self)
        d["last_maintenance_date"] = date_to_str(d["last_maintenance_date"])
        d["created_at"] = date_to_str(d["created_at"])
        return d

    @classmethod
    def from_dict(cls, d: dict) -> "Elevator":
        return cls(
            id=d.get("id", generate_id()),
            building_id=d.get("building_id", ""),
            code=d.get("code", ""),
            last_maintenance_date=str_to_date(d.get("last_maintenance_date")),
            maintenance_cycle_days=d.get("maintenance_cycle_days", 30),
            created_at=str_to_date(d.get("created_at")) or now_date()
        )


@dataclass
class Technician:
    """维修师傅"""
    id: str = field(default_factory=generate_id)
    name: str = ""
    phone: str = ""
    is_active: bool = True
    created_at: date = field(default_factory=now_date)

    def to_dict(self) -> dict:
        d = asdict(self)
        d["created_at"] = date_to_str(d["created_at"])
        return d

    @classmethod
    def from_dict(cls, d: dict) -> "Technician":
        return cls(
            id=d.get("id", generate_id()),
            name=d.get("name", ""),
            phone=d.get("phone", ""),
            is_active=d.get("is_active", True),
            created_at=str_to_date(d.get("created_at")) or now_date()
        )


@dataclass
class Vacation:
    """休假记录"""
    id: str = field(default_factory=generate_id)
    technician_id: str = ""
    start_date: date = field(default_factory=now_date)
    end_date: date = field(default_factory=now_date)
    reason: str = ""

    def to_dict(self) -> dict:
        d = asdict(self)
        d["start_date"] = date_to_str(d["start_date"])
        d["end_date"] = date_to_str(d["end_date"])
        return d

    @classmethod
    def from_dict(cls, d: dict) -> "Vacation":
        return cls(
            id=d.get("id", generate_id()),
            technician_id=d.get("technician_id", ""),
            start_date=str_to_date(d.get("start_date")) or now_date(),
            end_date=str_to_date(d.get("end_date")) or now_date(),
            reason=d.get("reason", "")
        )

    def covers(self, d: date) -> bool:
        return self.start_date <= d <= self.end_date


ORDER_TYPE_PERIODIC = "periodic"
ORDER_TYPE_FAULT = "fault"

ORDER_STATUS_PENDING = "pending"
ORDER_STATUS_ASSIGNED = "assigned"
ORDER_STATUS_COMPLETED = "completed"
ORDER_STATUS_OVERDUE = "overdue"
ORDER_STATUS_ESCALATED = "escalated"
ORDER_STATUS_CANCELLED = "cancelled"
ORDER_STATUS_SUSPENDED = "suspended"


@dataclass
class MaintenanceOrder:
    """维保单（周期单或故障单）"""
    id: str = field(default_factory=generate_id)
    order_no: str = ""
    elevator_id: str = ""
    technician_id: Optional[str] = None
    type: str = ORDER_TYPE_PERIODIC
    planned_date: Optional[date] = None
    due_date: Optional[date] = None
    status: str = ORDER_STATUS_PENDING
    fault_description: str = ""
    completed_date: Optional[date] = None
    proof_url: str = ""
    proof_notes: str = ""
    created_at: date = field(default_factory=now_date)
    assigned_at: Optional[date] = None
    notes: str = ""
    import_hash: str = ""

    def to_dict(self) -> dict:
        d = asdict(self)
        d["planned_date"] = date_to_str(d["planned_date"])
        d["due_date"] = date_to_str(d["due_date"])
        d["completed_date"] = date_to_str(d["completed_date"])
        d["created_at"] = date_to_str(d["created_at"])
        d["assigned_at"] = date_to_str(d["assigned_at"])
        return d

    @classmethod
    def from_dict(cls, d: dict) -> "MaintenanceOrder":
        return cls(
            id=d.get("id", generate_id()),
            order_no=d.get("order_no", ""),
            elevator_id=d.get("elevator_id", ""),
            technician_id=d.get("technician_id"),
            type=d.get("type", ORDER_TYPE_PERIODIC),
            planned_date=str_to_date(d.get("planned_date")),
            due_date=str_to_date(d.get("due_date")),
            status=d.get("status", ORDER_STATUS_PENDING),
            fault_description=d.get("fault_description", ""),
            completed_date=str_to_date(d.get("completed_date")),
            proof_url=d.get("proof_url", ""),
            proof_notes=d.get("proof_notes", ""),
            created_at=str_to_date(d.get("created_at")) or now_date(),
            assigned_at=str_to_date(d.get("assigned_at")),
            notes=d.get("notes", ""),
            import_hash=d.get("import_hash", "")
        )

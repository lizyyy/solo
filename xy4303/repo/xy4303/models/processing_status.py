from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, List
from uuid import uuid4

from models.enums import OrderStatus


@dataclass
class ReworkRecord:
    rework_id: str
    rework_count: int
    rework_reason: str
    rework_date: Optional[datetime] = None
    responsible_person: Optional[str] = None
    solution: str = ""
    resolved_at: Optional[datetime] = None
    is_resolved: bool = False
    internal_id: str = field(default_factory=lambda: uuid4().hex)

    def to_dict(self) -> dict:
        return {
            "internal_id": self.internal_id,
            "rework_id": self.rework_id,
            "rework_count": self.rework_count,
            "rework_reason": self.rework_reason,
            "rework_date": self.rework_date.isoformat() if self.rework_date else None,
            "responsible_person": self.responsible_person,
            "solution": self.solution,
            "resolved_at": self.resolved_at.isoformat() if self.resolved_at else None,
            "is_resolved": self.is_resolved,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "ReworkRecord":
        rework_date = None
        if data.get("rework_date"):
            rework_date = datetime.fromisoformat(data["rework_date"])
        
        resolved_at = None
        if data.get("resolved_at"):
            resolved_at = datetime.fromisoformat(data["resolved_at"])
        
        record = cls(
            rework_id=data["rework_id"],
            rework_count=data["rework_count"],
            rework_reason=data["rework_reason"],
            rework_date=rework_date,
            responsible_person=data.get("responsible_person"),
            solution=data.get("solution", ""),
            resolved_at=resolved_at,
            is_resolved=data.get("is_resolved", False),
        )
        record.internal_id = data.get("internal_id", record.internal_id)
        return record


@dataclass
class ProcessingStatus:
    model_id: str
    current_status: OrderStatus = OrderStatus.PENDING_RECEIVE
    received_date: Optional[datetime] = None
    expected_delivery_date: Optional[datetime] = None
    actual_delivery_date: Optional[datetime] = None
    rework_records: List[ReworkRecord] = field(default_factory=list)
    responsible_technician: Optional[str] = None
    last_updated: Optional[datetime] = None
    notes: str = ""
    internal_id: str = field(default_factory=lambda: uuid4().hex)

    @property
    def rework_count(self) -> int:
        return len(self.rework_records)

    @property
    def has_unresolved_rework(self) -> bool:
        return any(not r.is_resolved for r in self.rework_records)

    @property
    def days_until_delivery(self) -> Optional[int]:
        if self.expected_delivery_date and not self.actual_delivery_date:
            delta = self.expected_delivery_date - datetime.now()
            return delta.days
        return None

    def to_dict(self) -> dict:
        return {
            "internal_id": self.internal_id,
            "model_id": self.model_id,
            "current_status": self.current_status.value,
            "received_date": self.received_date.isoformat() if self.received_date else None,
            "expected_delivery_date": self.expected_delivery_date.isoformat() if self.expected_delivery_date else None,
            "actual_delivery_date": self.actual_delivery_date.isoformat() if self.actual_delivery_date else None,
            "rework_records": [r.to_dict() for r in self.rework_records],
            "responsible_technician": self.responsible_technician,
            "last_updated": self.last_updated.isoformat() if self.last_updated else None,
            "notes": self.notes,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "ProcessingStatus":
        received_date = None
        if data.get("received_date"):
            received_date = datetime.fromisoformat(data["received_date"])
        
        expected_delivery_date = None
        if data.get("expected_delivery_date"):
            expected_delivery_date = datetime.fromisoformat(data["expected_delivery_date"])
        
        actual_delivery_date = None
        if data.get("actual_delivery_date"):
            actual_delivery_date = datetime.fromisoformat(data["actual_delivery_date"])
        
        last_updated = None
        if data.get("last_updated"):
            last_updated = datetime.fromisoformat(data["last_updated"])
        
        current_status = OrderStatus(data.get("current_status", OrderStatus.PENDING_RECEIVE.value))
        
        rework_records = [
            ReworkRecord.from_dict(r) for r in data.get("rework_records", [])
        ]
        
        status = cls(
            model_id=data["model_id"],
            current_status=current_status,
            received_date=received_date,
            expected_delivery_date=expected_delivery_date,
            actual_delivery_date=actual_delivery_date,
            rework_records=rework_records,
            responsible_technician=data.get("responsible_technician"),
            last_updated=last_updated,
            notes=data.get("notes", ""),
        )
        status.internal_id = data.get("internal_id", status.internal_id)
        return status

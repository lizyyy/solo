from dataclasses import dataclass, field, asdict
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum
import uuid
import json
import os


class RecordStatus(str, Enum):
    PENDING = "待验算"
    VERIFIED = "验算通过"
    SUSPENDED = "挂起待确认"
    REJECTED = "验算不通过"
    CONFIRMED = "人工已确认"


class SuspensionReason(str, Enum):
    EXTRAPOLATION_BOUNDARY = "外推越界"
    UNIT_INCONSISTENT = "单位换算偏差"
    DATA_MISSING = "关键数据缺失"


@dataclass
class Attachment:
    kind: str
    content: str
    added_at: str = field(default_factory=lambda: datetime.now().strftime("%Y-%m-%d %H:%M:%S"))


@dataclass
class HistoryEntry:
    field_changed: str
    old_value: Any
    new_value: Any
    reason: str
    operator: str
    changed_at: str = field(default_factory=lambda: datetime.now().strftime("%Y-%m-%d %H:%M:%S"))

    def to_dict(self):
        return {
            "field_changed": self.field_changed,
            "old_value": self.old_value,
            "new_value": self.new_value,
            "reason": self.reason,
            "operator": self.operator,
            "changed_at": self.changed_at,
        }


@dataclass
class BoundaryInfo:
    variable: str
    current_value: float
    lower_bound: float
    upper_bound: float
    direction: str

    def to_dict(self):
        return asdict(self)


@dataclass
class VerificationRecord:
    id: str
    student_name: str
    formula_desc: str
    source_trace: str
    input_value: float
    input_unit: str
    target_unit: str
    expected_result: float
    tolerance: float = 0.05
    actual_result: Optional[float] = None
    status: RecordStatus = RecordStatus.PENDING
    attachments: List[Attachment] = field(default_factory=list)
    history: List[HistoryEntry] = field(default_factory=list)
    suspension_reason: Optional[SuspensionReason] = None
    boundary_info: Optional[BoundaryInfo] = None
    confirmation_note: Optional[str] = None
    confirmed_by: Optional[str] = None
    confirmed_at: Optional[str] = None
    created_at: str = field(default_factory=lambda: datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    last_updated: str = field(default_factory=lambda: datetime.now().strftime("%Y-%m-%d %H:%M:%S"))

    @classmethod
    def create(cls, **kwargs):
        if "id" not in kwargs:
            kwargs["id"] = uuid.uuid4().hex[:8]
        attachments_data = kwargs.pop("attachments", [])
        history_data = kwargs.pop("history", [])
        boundary_data = kwargs.pop("boundary_info", None)
        status_raw = kwargs.pop("status", RecordStatus.PENDING)
        suspension_raw = kwargs.pop("suspension_reason", None)
        if isinstance(status_raw, str):
            for s in RecordStatus:
                if s.value == status_raw:
                    kwargs["status"] = s
                    break
            else:
                kwargs["status"] = RecordStatus.PENDING
        else:
            kwargs["status"] = status_raw
        if isinstance(suspension_raw, str):
            for s in SuspensionReason:
                if s.value == suspension_raw:
                    kwargs["suspension_reason"] = s
                    break
            else:
                kwargs["suspension_reason"] = None
        else:
            kwargs["suspension_reason"] = suspension_raw
        record = cls(**kwargs)
        record.attachments = [Attachment(**a) if isinstance(a, dict) else a for a in attachments_data]
        record.history = [HistoryEntry(**h) if isinstance(h, dict) else h for h in history_data]
        if boundary_data and isinstance(boundary_data, dict):
            record.boundary_info = BoundaryInfo(**boundary_data)
        elif boundary_data:
            record.boundary_info = boundary_data
        return record

    def to_dict(self):
        d = asdict(self)
        d["status"] = self.status.value if isinstance(self.status, RecordStatus) else self.status
        if self.suspension_reason:
            d["suspension_reason"] = self.suspension_reason.value if isinstance(self.suspension_reason, SuspensionReason) else self.suspension_reason
        d["attachments"] = [asdict(a) for a in self.attachments]
        d["history"] = [h.to_dict() for h in self.history]
        if self.boundary_info:
            d["boundary_info"] = self.boundary_info.to_dict()
        return d

    def add_attachment(self, kind: str, content: str):
        self.attachments.append(Attachment(kind=kind, content=content))
        self.last_updated = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    def add_history(self, field_changed: str, old_value: Any, new_value: Any, reason: str, operator: str):
        self.history.append(HistoryEntry(
            field_changed=field_changed,
            old_value=old_value,
            new_value=new_value,
            reason=reason,
            operator=operator,
        ))
        self.last_updated = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    def suspend(self, reason: SuspensionReason, boundary_info: Optional[BoundaryInfo] = None):
        self.status = RecordStatus.SUSPENDED
        self.suspension_reason = reason
        self.boundary_info = boundary_info
        self.last_updated = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    def confirm(self, operator: str, note: str, override_result: Optional[float] = None):
        old_status = self.status.value if isinstance(self.status, RecordStatus) else self.status
        old_result = self.actual_result
        self.status = RecordStatus.CONFIRMED
        self.confirmed_by = operator
        self.confirmed_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        self.confirmation_note = note
        if override_result is not None:
            self.actual_result = override_result
            self.add_history(
                field_changed="actual_result",
                old_value=old_result,
                new_value=override_result,
                reason=f"人工确认改口径: {note}",
                operator=operator,
            )
        self.add_history(
            field_changed="status",
            old_value=old_status,
            new_value=RecordStatus.CONFIRMED.value,
            reason=note,
            operator=operator,
        )

from __future__ import annotations

import hashlib
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Optional


class ReviewStatus(Enum):
    PENDING = "pending"
    IN_REVIEW = "in_review"
    SUSPENDED = "suspended"
    APPROVED = "approved"
    REJECTED = "rejected"


class MaterialType(Enum):
    INSPECTION_FORM = "inspection_form"
    SUPPLEMENTARY = "supplementary"
    VERBAL_NOTE = "verbal_note"


@dataclass
class InspectionRecord:
    record_id: str = field(default_factory=lambda: uuid.uuid4().hex[:12])
    blade_id: str = ""
    timestamp: datetime = field(default_factory=datetime.now)
    value: float = 0.0
    metric_name: str = ""
    content_hash: str = ""
    manual_note: str = ""

    def compute_hash(self) -> str:
        raw = f"{self.blade_id}|{self.timestamp.isoformat()}|{self.value}|{self.metric_name}"
        self.content_hash = hashlib.sha256(raw.encode()).hexdigest()[:16]
        return self.content_hash


@dataclass
class SupplementaryMaterial:
    material_id: str = field(default_factory=lambda: uuid.uuid4().hex[:12])
    original_name: str = ""
    current_name: str = ""
    material_type: MaterialType = MaterialType.SUPPLEMENTARY
    content_hash: str = ""
    content: str = ""
    created_at: datetime = field(default_factory=datetime.now)
    version: int = 1
    name_changed: bool = False
    stance_changed: bool = False
    previous_stance: str = ""

    def compute_hash(self) -> str:
        raw = f"{self.content}"
        self.content_hash = hashlib.sha256(raw.encode()).hexdigest()[:16]
        return self.content_hash


@dataclass
class JudgmentChange:
    field_name: str = ""
    old_value: Any = None
    new_value: Any = None
    changed_at: datetime = field(default_factory=datetime.now)
    changed_by: str = ""
    reason: str = ""


@dataclass
class AuditLogEntry:
    entry_id: str = field(default_factory=lambda: uuid.uuid4().hex[:12])
    report_id: str = ""
    action: str = ""
    operator: str = ""
    timestamp: datetime = field(default_factory=datetime.now)
    changes: list[JudgmentChange] = field(default_factory=list)
    detail: str = ""


@dataclass
class SuspensionRecord:
    suspension_id: str = field(default_factory=lambda: uuid.uuid4().hex[:12])
    report_id: str = ""
    reason: str = ""
    gap_start: Optional[datetime] = None
    gap_end: Optional[datetime] = None
    created_at: datetime = field(default_factory=datetime.now)
    resolved: bool = False
    resolved_by: str = ""
    resolution_note: str = ""


@dataclass
class BladeReport:
    report_id: str = field(default_factory=lambda: uuid.uuid4().hex[:12])
    title: str = ""
    blade_ids: list[str] = field(default_factory=list)
    status: ReviewStatus = ReviewStatus.PENDING
    records: list[InspectionRecord] = field(default_factory=list)
    materials: list[SupplementaryMaterial] = field(default_factory=list)
    audit_logs: list[AuditLogEntry] = field(default_factory=list)
    suspensions: list[SuspensionRecord] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    operator: str = ""
    request_hash: str = ""

    def compute_request_hash(self) -> str:
        blade_key = ",".join(sorted(self.blade_ids))
        raw = f"{self.title}|{blade_key}"
        self.request_hash = hashlib.sha256(raw.encode()).hexdigest()[:16]
        return self.request_hash

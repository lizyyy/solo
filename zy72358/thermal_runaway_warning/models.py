from __future__ import annotations

import enum
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional


class ProcessingStatus(enum.Enum):
    PENDING = "pending"
    THRESHOLD_EXCEEDED = "threshold_exceeded"
    AWAITING_REVIEW = "awaiting_review"
    CONFIRMED_ABNORMAL = "confirmed_abnormal"
    CONFIRMED_NORMAL = "confirmed_normal"
    SUPPRESSED_BY_AVERAGE = "suppressed_by_average"
    RECALCULATED = "recalculated"


@dataclass
class SensorRecord:
    sensor_id: str
    original_row: int
    timestamp: str
    value: float
    unit: str
    status: ProcessingStatus = ProcessingStatus.PENDING
    imported_at: str = field(default_factory=lambda: datetime.now().isoformat())
    batch_id: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "sensor_id": self.sensor_id,
            "original_row": self.original_row,
            "timestamp": self.timestamp,
            "value": self.value,
            "unit": self.unit,
            "status": self.status.value,
            "imported_at": self.imported_at,
            "batch_id": self.batch_id,
        }


@dataclass
class ThresholdEvent:
    sensor_id: str
    record_original_row: int
    value: float
    threshold: float
    event_type: str
    status: ProcessingStatus = ProcessingStatus.THRESHOLD_EXCEEDED
    detected_at: str = field(default_factory=lambda: datetime.now().isoformat())
    review_note: str = ""
    reviewer: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "sensor_id": self.sensor_id,
            "record_original_row": self.record_original_row,
            "value": self.value,
            "threshold": self.threshold,
            "event_type": self.event_type,
            "status": self.status.value,
            "detected_at": self.detected_at,
            "review_note": self.review_note,
            "reviewer": self.reviewer,
        }


@dataclass
class AuditEntry:
    timestamp: str
    sensor_id: str
    original_row: int
    field_changed: str
    old_value: Any
    new_value: Any
    changed_by: str
    reason: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "timestamp": self.timestamp,
            "sensor_id": self.sensor_id,
            "original_row": self.original_row,
            "field_changed": self.field_changed,
            "old_value": str(self.old_value),
            "new_value": str(self.new_value),
            "changed_by": self.changed_by,
            "reason": self.reason,
        }


@dataclass
class WorkingConditionPhoto:
    sensor_id: str
    photo_path: str
    description: str = ""
    attached_at: str = field(default_factory=lambda: datetime.now().isoformat())
    attached_by: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "sensor_id": self.sensor_id,
            "photo_path": self.photo_path,
            "description": self.description,
            "attached_at": self.attached_at,
            "attached_by": self.attached_by,
        }


@dataclass
class UnitConversionNote:
    from_unit: str
    to_unit: str
    factor: float
    description: str = ""
    updated_at: str = field(default_factory=lambda: datetime.now().isoformat())
    updated_by: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "from_unit": self.from_unit,
            "to_unit": self.to_unit,
            "factor": self.factor,
            "description": self.description,
            "updated_at": self.updated_at,
            "updated_by": self.updated_by,
        }


@dataclass
class WarningResult:
    sensor_id: str
    original_row: int
    timestamp: str
    raw_value: float
    display_value: float
    unit: str
    threshold: float
    status: ProcessingStatus
    is_over_threshold: bool
    suppressed_by_average: bool
    photos: List[WorkingConditionPhoto] = field(default_factory=list)
    audit_trail: List[AuditEntry] = field(default_factory=list)
    unit_conversion: Optional[UnitConversionNote] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "sensor_id": self.sensor_id,
            "original_row": self.original_row,
            "timestamp": self.timestamp,
            "raw_value": self.raw_value,
            "display_value": self.display_value,
            "unit": self.unit,
            "threshold": self.threshold,
            "status": self.status.value,
            "is_over_threshold": self.is_over_threshold,
            "suppressed_by_average": self.suppressed_by_average,
            "photos": [p.to_dict() for p in self.photos],
            "audit_trail": [a.to_dict() for a in self.audit_trail],
            "unit_conversion": self.unit_conversion.to_dict() if self.unit_conversion else None,
        }

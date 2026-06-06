from dataclasses import dataclass, field, asdict
from datetime import datetime
from typing import Optional, List, Dict, Any
from enum import Enum


class WorkflowState(str, Enum):
    STEP_1_NOTES_IMPORTED = "step_1_notes_imported"
    STEP_2_THRESHOLD_REVIEWED = "step_2_threshold_reviewed"
    STEP_3_SAFETY_UPDATED = "step_3_safety_updated"


class ReviewStatus(str, Enum):
    NORMAL = "normal"
    PENDING_REVIEW = "pending_review"
    REVIEWED = "reviewed"
    REJECTED = "rejected"


@dataclass
class Sensor:
    sensor_id: str
    physical_location: str
    tank_name: str
    created_at: datetime = field(default_factory=datetime.now)
    is_active: bool = True

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data["created_at"] = self.created_at.isoformat()
        return data

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Sensor":
        data = data.copy()
        data["created_at"] = datetime.fromisoformat(data["created_at"])
        return cls(**data)


@dataclass
class SensorMapping:
    old_sensor_id: str
    new_sensor_id: str
    detected_at: datetime = field(default_factory=datetime.now)
    review_status: ReviewStatus = ReviewStatus.PENDING_REVIEW
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    confidence: float = 0.0
    evidence: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data["detected_at"] = self.detected_at.isoformat()
        if self.reviewed_at:
            data["reviewed_at"] = self.reviewed_at.isoformat()
        return data

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "SensorMapping":
        data = data.copy()
        data["detected_at"] = datetime.fromisoformat(data["detected_at"])
        if data.get("reviewed_at"):
            data["reviewed_at"] = datetime.fromisoformat(data["reviewed_at"])
        if isinstance(data.get("review_status"), str):
            data["review_status"] = ReviewStatus(data["review_status"])
        return cls(**data)


@dataclass
class InspectionNote:
    note_id: str
    import_batch_id: str
    sensor_id: str
    level_reading: float
    temperature: Optional[float] = None
    pressure: Optional[float] = None
    handwritten_note: str = ""
    recorded_at: datetime = field(default_factory=datetime.now)
    imported_at: datetime = field(default_factory=datetime.now)
    imported_by: str = ""
    content_hash: str = ""

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data["recorded_at"] = self.recorded_at.isoformat()
        data["imported_at"] = self.imported_at.isoformat()
        return data

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "InspectionNote":
        data = data.copy()
        data["recorded_at"] = datetime.fromisoformat(data["recorded_at"])
        data["imported_at"] = datetime.fromisoformat(data["imported_at"])
        return cls(**data)


@dataclass
class SafetyThreshold:
    threshold_id: str
    tank_name: str
    min_safe_level: float
    max_safe_level: float
    warning_low: float
    warning_high: float
    created_at: datetime = field(default_factory=datetime.now)
    version: int = 1
    is_active: bool = True

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data["created_at"] = self.created_at.isoformat()
        return data

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "SafetyThreshold":
        data = data.copy()
        data["created_at"] = datetime.fromisoformat(data["created_at"])
        return cls(**data)


@dataclass
class ChangeHistory:
    history_id: str
    record_id: str
    field_name: str
    old_value: Any
    new_value: Any
    changed_at: datetime = field(default_factory=datetime.now)
    changed_by: str = ""
    change_reason: str = ""

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data["changed_at"] = self.changed_at.isoformat()
        return data

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ChangeHistory":
        data = data.copy()
        data["changed_at"] = datetime.fromisoformat(data["changed_at"])
        return cls(**data)


@dataclass
class LevelConversionRecord:
    record_id: str
    sensor_id: str
    original_note_id: str
    threshold_id: str
    raw_level: float
    converted_level: float
    temperature_compensation: float = 0.0
    status: ReviewStatus = ReviewStatus.NORMAL
    workflow_state: WorkflowState = WorkflowState.STEP_1_NOTES_IMPORTED
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    sensor_mapping_id: Optional[str] = None
    review_notes: str = ""

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data["created_at"] = self.created_at.isoformat()
        data["updated_at"] = self.updated_at.isoformat()
        return data

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "LevelConversionRecord":
        data = data.copy()
        data["created_at"] = datetime.fromisoformat(data["created_at"])
        data["updated_at"] = datetime.fromisoformat(data["updated_at"])
        if isinstance(data.get("status"), str):
            data["status"] = ReviewStatus(data["status"])
        if isinstance(data.get("workflow_state"), str):
            data["workflow_state"] = WorkflowState(data["workflow_state"])
        return cls(**data)

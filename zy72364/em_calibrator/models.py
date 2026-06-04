import enum
import datetime
from dataclasses import dataclass, field
from typing import Optional


class RecordStatus(enum.Enum):
    IMPORTED = "imported"
    ENGINEER_REVIEW = "engineer_review"
    SENSOR_CHANGED = "sensor_changed"
    SAFETY_REVIEW = "safety_review"
    COMPLETED = "completed"


class ChangeType(enum.Enum):
    IMPORT = "import"
    MANUAL_EDIT = "manual_edit"
    SENSOR_REMAP = "sensor_remap"
    ROLLBACK = "rollback"
    STATUS_CHANGE = "status_change"


class SafetyVerdict(enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


@dataclass
class CalibrationBatch:
    id: Optional[int] = None
    batch_hash: str = ""
    source_file: str = ""
    imported_at: str = field(default_factory=lambda: datetime.datetime.now().isoformat())
    record_count: int = 0


@dataclass
class TemperatureRecord:
    id: Optional[int] = None
    batch_id: int = 0
    original_line_no: int = 0
    sensor_id: str = ""
    equipment_position: str = ""
    temperature_value: float = 0.0
    caliber: str = ""
    remark: str = ""
    status: str = RecordStatus.IMPORTED.value
    created_at: str = field(default_factory=lambda: datetime.datetime.now().isoformat())
    updated_at: str = field(default_factory=lambda: datetime.datetime.now().isoformat())


@dataclass
class ChangeHistory:
    id: Optional[int] = None
    record_id: int = 0
    change_type: str = ChangeType.IMPORT.value
    field_name: str = ""
    old_value: str = ""
    new_value: str = ""
    changed_by: str = ""
    changed_at: str = field(default_factory=lambda: datetime.datetime.now().isoformat())
    reason: str = ""


@dataclass
class SensorMapping:
    id: Optional[int] = None
    equipment_position: str = ""
    old_sensor_id: str = ""
    new_sensor_id: str = ""
    detected_at: str = field(default_factory=lambda: datetime.datetime.now().isoformat())
    approved_by: str = ""
    verdict: str = SafetyVerdict.PENDING.value
    remark: str = ""


@dataclass
class WorkflowLog:
    id: Optional[int] = None
    record_id: int = 0
    from_status: str = ""
    to_status: str = ""
    operator: str = ""
    operated_at: str = field(default_factory=lambda: datetime.datetime.now().isoformat())
    note: str = ""


STATUS_TRANSITIONS = {
    RecordStatus.IMPORTED.value: [RecordStatus.ENGINEER_REVIEW.value],
    RecordStatus.ENGINEER_REVIEW.value: [
        RecordStatus.SAFETY_REVIEW.value,
        RecordStatus.SENSOR_CHANGED.value,
    ],
    RecordStatus.SENSOR_CHANGED.value: [RecordStatus.SAFETY_REVIEW.value],
    RecordStatus.SAFETY_REVIEW.value: [
        RecordStatus.COMPLETED.value,
        RecordStatus.SENSOR_CHANGED.value,
        RecordStatus.ENGINEER_REVIEW.value,
    ],
    RecordStatus.COMPLETED.value: [RecordStatus.ENGINEER_REVIEW.value],
}

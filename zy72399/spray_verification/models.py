from datetime import datetime, timedelta
from enum import Enum
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class RecordStatus(str, Enum):
    NORMAL = "normal"
    MISSING_HALF_HOUR = "missing_half_hour"
    SUPPLEMENTED = "supplemented"
    PENDING_REVIEW = "pending_review"
    CONFLICT = "conflict"
    CONFIRMED = "confirmed"
    REJECTED = "rejected"


class CaliberType(str, Enum):
    OLD = "old"
    NEW = "new"


class SensorRecord(BaseModel):
    sensor_id: str
    sample_time: datetime
    coverage_rate: float
    pressure: float
    caliber: CaliberType = CaliberType.NEW
    source: str = "sensor_import"
    notes: Optional[str] = None


class WorkingConditionPhoto(BaseModel):
    photo_id: str
    sensor_id: str
    capture_time: datetime
    caliber: CaliberType
    coverage_visual: str
    supplement_note: Optional[str] = None


class ConflictEvidence(BaseModel):
    conflict_type: str
    sensor_value: Any
    photo_value: Any
    description: str


class VerificationRecord(BaseModel):
    record_id: str
    sensor_record: SensorRecord
    photo_record: Optional[WorkingConditionPhoto] = None
    status: RecordStatus
    conflicts: List[ConflictEvidence] = Field(default_factory=list)
    review_comments: Optional[str] = None
    reviewer: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)


class ReviewDiagramData(BaseModel):
    record_id: str
    sensor_id: str
    status: RecordStatus
    coverage_rate: float
    sample_time: datetime
    caliber: CaliberType
    has_photo: bool
    has_conflict: bool
    is_supplemented: bool


class WorkflowStep(str, Enum):
    STEP1_IMPORT = "sensor_import"
    STEP2_PHOTO_REVIEW = "laotang_photo_review"
    STEP3_DIAGRAM_UPDATE = "diagram_update"


class WorkflowState(BaseModel):
    current_step: WorkflowStep
    records: List[VerificationRecord]
    history: List[Dict[str, Any]] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.now)

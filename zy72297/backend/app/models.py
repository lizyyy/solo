from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from enum import Enum


class EvidenceSource(str, Enum):
    COORDINATE_ORIGIN = "coordinate_origin"
    INSPECTION_PHOTO = "inspection_photo"
    MANUAL = "manual"


class RecordStatus(str, Enum):
    IMPORTED = "imported"
    PHOTO_REVIEWED = "photo_reviewed"
    ANNOTATION_UPDATED = "annotation_updated"
    PENDING_REVIEW = "pending_review"
    CONFIRMED = "confirmed"
    ROLLED_BACK = "rolled_back"


class ConflictType(str, Enum):
    DUPLICATE_NAME = "duplicate_name"
    POSITION_MISMATCH = "position_mismatch"
    TYPE_MISMATCH = "type_mismatch"


class EvidenceEntry(BaseModel):
    source: EvidenceSource
    original_line_number: Optional[int] = None
    original_content: str
    photo_id: Optional[str] = None
    operator: str = "system"
    timestamp: datetime = Field(default_factory=datetime.now)


class NameConflict(BaseModel):
    conflict_id: str
    conflict_type: ConflictType
    obstacle_id: str
    names: list[str]
    evidence: list[EvidenceEntry]
    resolution: Optional[str] = None
    resolved_by: Optional[str] = None
    resolved_at: Optional[datetime] = None
    status: RecordStatus = RecordStatus.PENDING_REVIEW


class ProfileRecord(BaseModel):
    record_id: str
    obstacle_id: str
    obstacle_name: str
    water_depth_mm: float
    position_x: float
    position_y: float
    position_z: float
    evidence_trail: list[EvidenceEntry] = []
    manual_changes: list[EvidenceEntry] = []
    status: RecordStatus = RecordStatus.IMPORTED
    conflict_ids: list[str] = []
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)


class WaterDepthProfile(BaseModel):
    profile_id: str
    project_name: str
    coordinate_origin_description: str = ""
    records: list[ProfileRecord] = []
    conflicts: list[NameConflict] = []
    audit_log: list[dict] = []
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)


class WorkflowStep(str, Enum):
    STEP1_IMPORT_ORIGIN = "step1_import_origin"
    STEP2_REVIEW_PHOTOS = "step2_review_photos"
    STEP3_UPDATE_ANNOTATION = "step3_update_annotation"

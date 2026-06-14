from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, List, Dict, Any
from enum import Enum


class SampleStatus(str, Enum):
    PENDING = "pending"
    ANNOTATOR_IMPORTED = "annotator_imported"
    MANAGER_REVIEWED = "manager_reviewed"
    MODEL_OUTPUT_ADDED = "model_output_added"
    MODEL_VERSION_UPDATED = "model_version_updated"
    NEEDS_REVIEW = "needs_review"
    CONFIRMED_VIOLATION = "confirmed_violation"
    CONFIRMED_NORMAL = "confirmed_normal"
    LOW_CONFIDENCE = "low_confidence"
    ROLLED_BACK = "rolled_back"


class ChangeType(str, Enum):
    CREATE = "create"
    STATUS_CHANGE = "status_change"
    ANNOTATION_EDIT = "annotation_edit"
    MANAGER_REVIEW = "manager_review"
    MODEL_OUTPUT_ADD = "model_output_add"
    MODEL_VERSION_UPDATE = "model_version_update"
    COMMENT_ADD = "comment_add"
    DUPLICATE_DETECTED = "duplicate_detected"
    ROLLBACK = "rollback"


@dataclass
class OriginalAnnotation:
    source_file: str
    line_number: int
    raw_content: str
    annotator_conclusion: str
    model_version: str = "v1"
    source_url: Optional[str] = None
    business_note: Optional[str] = None
    annotation_hash: Optional[str] = None
    annotator_name: Optional[str] = None
    import_timestamp: datetime = field(default_factory=datetime.now)
    conclusion: Optional[str] = None


@dataclass
class ModelOutput:
    version: str
    violation_score: float
    confidence: float
    raw_fragment: str
    operator: str
    timestamp: datetime = field(default_factory=datetime.now)
    model_metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ManualEdit:
    field: str
    old_value: Any
    new_value: Any
    operator: str
    reason: str
    editor: Optional[str] = None
    edit_timestamp: datetime = field(default_factory=datetime.now)
    field_changed: Optional[str] = None


@dataclass
class HistoryRecord:
    record_id: str
    change_type: ChangeType
    timestamp: datetime
    operator: str
    before_snapshot: Dict[str, Any]
    after_snapshot: Dict[str, Any]
    manual_edits: List[ManualEdit] = field(default_factory=list)
    comment: Optional[str] = None


@dataclass
class ViolationSample:
    sample_id: str
    cover_image_url: str
    video_id: str
    current_status: SampleStatus
    original_annotation: OriginalAnnotation
    current_annotation: str
    model_outputs: List[ModelOutput] = field(default_factory=list)
    history: List[HistoryRecord] = field(default_factory=list)
    manager_notes: Optional[str] = None
    kb_editor_notes: Optional[str] = None
    is_low_confidence: bool = False
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)


@dataclass
class BoundaryRule:
    rule_id: str
    name: str
    description: str
    condition: str
    action: str
    rollback_supported: bool

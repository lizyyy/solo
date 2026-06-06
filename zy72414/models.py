from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, List, Dict, Any
from enum import Enum


class AdjustmentStatus(str, Enum):
    PENDING = "pending"
    NORMAL = "normal"
    REWORK_REVIEW = "rework_review"
    CONFIRMED = "confirmed"
    ROLLED_BACK = "rolled_back"


class ChangeType(str, Enum):
    IMPORT = "import"
    MANUAL_EDIT = "manual_edit"
    STATUS_CHANGE = "status_change"
    REHEARSAL_UPDATE = "rehearsal_update"
    ROLLBACK = "rollback"


@dataclass
class TunerMessage:
    id: str
    original_row_number: int
    raw_content: str
    seat_number: str
    instrument: str
    track_remark: str
    import_batch_id: str
    imported_at: datetime
    source_file: str
    is_rework: bool = False
    rework_reason: Optional[str] = None

    def __post_init__(self):
        if "返工" in self.track_remark or "rework" in self.track_remark.lower():
            self.is_rework = True
            self.rework_reason = self.track_remark


@dataclass
class SeatAdjustment:
    id: str
    tuner_message_id: str
    seat_number: str
    instrument: str
    status: AdjustmentStatus
    current_remark: str
    created_at: datetime
    updated_at: datetime
    created_by: str = "system"
    updated_by: str = "system"
    rehearsal_group_signup: Optional[Dict[str, Any]] = None
    rehearsal_change_record: Optional[Dict[str, Any]] = None


@dataclass
class ChangeHistory:
    id: str
    adjustment_id: str
    change_type: ChangeType
    field_name: Optional[str]
    old_value: Optional[Any]
    new_value: Optional[Any]
    changed_by: str
    changed_at: datetime
    reason: Optional[str] = None


@dataclass
class ImportBatch:
    id: str
    source_file: str
    imported_at: datetime
    imported_by: str
    record_count: int
    content_hash: str
    is_duplicate: bool = False
    duplicate_of_batch: Optional[str] = None


@dataclass
class RehearsalRecord:
    id: str
    date: str
    group_signup_data: Dict[str, Any]
    change_records: List[Dict[str, Any]] = field(default_factory=list)
    updated_at: datetime = field(default_factory=datetime.now)

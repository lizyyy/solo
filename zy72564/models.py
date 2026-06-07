from dataclasses import dataclass, field, asdict
from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any
import uuid


class SampleStatus(str, Enum):
    IMPORTED = "imported"
    FEATURE_ADDED = "feature_added"
    EXPERIMENT_UPDATED = "experiment_updated"
    PENDING_REVIEW = "pending_review"
    REVIEW_APPROVED = "review_approved"
    REVIEW_REJECTED = "review_rejected"
    ROLLED_BACK = "rolled_back"


class ChangeType(str, Enum):
    CREATE = "create"
    UPDATE_FEATURE = "update_feature"
    UPDATE_EXPERIMENT = "update_experiment"
    UPDATE_REMARK = "update_remark"
    STATUS_CHANGE = "status_change"
    REVIEW_DECISION = "review_decision"
    ROLLBACK = "rollback"


class ScoreGapLevel(str, Enum):
    NONE = "none"
    ONE_BUCKET = "one_bucket"
    MULTI_BUCKET = "multi_bucket"


@dataclass
class EvalSample:
    sample_id: str
    original_row_number: int
    slice_id: str
    feature_snapshot_id: Optional[str] = None
    offline_score: Optional[float] = None
    online_score: Optional[float] = None
    score_bucket_offline: Optional[int] = None
    score_bucket_online: Optional[int] = None
    score_gap_level: ScoreGapLevel = ScoreGapLevel.NONE
    remark: Optional[str] = None
    status: SampleStatus = SampleStatus.IMPORTED
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    created_by: str = "system"
    updated_by: str = "system"
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["created_at"] = self.created_at.isoformat()
        d["updated_at"] = self.updated_at.isoformat()
        d["status"] = self.status.value
        d["score_gap_level"] = self.score_gap_level.value
        return d


@dataclass
class ChangeRecord:
    change_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    sample_id: str = ""
    change_type: ChangeType = ChangeType.UPDATE_REMARK
    field_name: Optional[str] = None
    old_value: Optional[Any] = None
    new_value: Optional[Any] = None
    changed_by: str = "system"
    changed_at: datetime = field(default_factory=datetime.now)
    remark: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["change_type"] = self.change_type.value
        d["changed_at"] = self.changed_at.isoformat()
        return d

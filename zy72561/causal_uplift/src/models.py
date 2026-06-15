from dataclasses import dataclass, field, asdict
from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any


class RecordStatus(str, Enum):
    IMPORTED = "IMPORTED"
    NORMAL = "NORMAL"
    FEATURE_MISSING_DEFAULT = "FEATURE_MISSING_DEFAULT"
    YAML_SUPPLEMENT_OLD_CALIBER = "YAML_SUPPLEMENT_OLD_CALIBER"
    CONFLICT_DETECTED = "CONFLICT_DETECTED"
    PENDING_REVIEW = "PENDING_REVIEW"
    CONFIRMED = "CONFIRMED"
    REJECTED = "REJECTED"
    REVIEW_COMPLETED = "REVIEW_COMPLETED"


class ReviewRole(str, Enum):
    EXPERIMENT_PLATFORM = "实验平台负责人"
    RECOMMEND_LEAD = "推荐负责人"


@dataclass
class CandidateRecord:
    sample_id: str
    user_id: str
    scene: str
    uplift_score: float
    features: Dict[str, Any]
    feature_missing: bool = False
    default_score_applied: bool = False
    status: RecordStatus = RecordStatus.IMPORTED
    caliber_source: str = "online"
    imported_at: str = field(default_factory=lambda: datetime.now().isoformat())
    raw_data: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["status"] = self.status.value
        return d


@dataclass
class ConflictEvidence:
    sample_id: str
    field_name: str
    candidate_table_value: Any
    yaml_value: Any
    description: str

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class ReviewAction:
    sample_id: str
    role: ReviewRole
    actor: str
    action: str
    reason: str
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())
    before_status: Optional[RecordStatus] = None
    after_status: Optional[RecordStatus] = None
    field_changes: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["role"] = self.role.value
        if self.before_status:
            d["before_status"] = self.before_status.value
        if self.after_status:
            d["after_status"] = self.after_status.value
        return d


@dataclass
class ExplainableSummary:
    sample_id: str
    status: RecordStatus
    summary_text: str
    score_breakdown: Dict[str, Any]
    data_sources: List[str]
    review_history_refs: List[str]
    updated_at: str = field(default_factory=lambda: datetime.now().isoformat())

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["status"] = self.status.value
        return d


@dataclass
class PipelineState:
    records: Dict[str, CandidateRecord] = field(default_factory=dict)
    conflicts: Dict[str, List[ConflictEvidence]] = field(default_factory=dict)
    review_history: List[ReviewAction] = field(default_factory=list)
    summaries: Dict[str, ExplainableSummary] = field(default_factory=dict)

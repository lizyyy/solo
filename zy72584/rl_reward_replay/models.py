from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any
from enum import Enum
from datetime import datetime


class FeatureStatus(str, Enum):
    NORMAL = "normal"
    MISSING_WITH_DEFAULT = "missing_with_default"
    MISSING_NO_DEFAULT = "missing_no_default"
    OUTLIER = "outlier"


class ReviewStatus(str, Enum):
    PENDING = "pending"
    REVIEWED_BY_XIAOQIAO = "reviewed_by_xiaoqiao"
    CONFIRMED_BY_REC_LEADER = "confirmed_by_rec_leader"
    NEEDS_FOLLOWUP = "needs_followup"


class ResponsibleRole(str, Enum):
    ALGORITHM_ENGINEER = "algorithm_engineer"
    REC_LEADER = "rec_leader"
    DATA_ENGINEER = "data_engineer"


@dataclass
class FeatureInfo:
    name: str
    status: FeatureStatus
    expected_value: Optional[Any] = None
    actual_value: Optional[Any] = None
    default_value: Optional[Any] = None
    description: str = ""
    confidence_score: float = 1.0


@dataclass
class EvalSlice:
    slice_id: str
    timestamp: datetime
    features: Dict[str, FeatureInfo] = field(default_factory=dict)
    reward_score: float = 0.0
    predicted_reward: float = 0.0
    context: Dict[str, Any] = field(default_factory=dict)
    review_status: ReviewStatus = ReviewStatus.PENDING
    reviewer_notes: str = ""

    @property
    def has_missing_features(self) -> bool:
        return any(
            f.status in (FeatureStatus.MISSING_WITH_DEFAULT, FeatureStatus.MISSING_NO_DEFAULT)
            for f in self.features.values()
        )

    @property
    def missing_features(self) -> List[FeatureInfo]:
        return [
            f for f in self.features.values()
            if f.status in (FeatureStatus.MISSING_WITH_DEFAULT, FeatureStatus.MISSING_NO_DEFAULT)
        ]


@dataclass
class YamlParams:
    param_id: str
    model_name: str
    feature_list: List[str] = field(default_factory=list)
    reward_weights: Dict[str, float] = field(default_factory=dict)
    default_values: Dict[str, Any] = field(default_factory=dict)
    feature_descriptions: Dict[str, str] = field(default_factory=dict)
    threshold_config: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.now)
    version: str = "1.0"


@dataclass
class ActionItem:
    description: str
    responsible: ResponsibleRole
    priority: str = "medium"
    due_date: Optional[datetime] = None
    completed: bool = False


@dataclass
class ExplainableSummary:
    slice_id: str
    why_kept: str
    missing_materials: List[str] = field(default_factory=list)
    next_step: str = ""
    responsible_person: ResponsibleRole = ResponsibleRole.ALGORITHM_ENGINEER
    feature_insights: Dict[str, str] = field(default_factory=dict)
    action_items: List[ActionItem] = field(default_factory=list)
    generated_at: datetime = field(default_factory=datetime.now)
    review_note: str = ""


@dataclass
class ReplaySession:
    session_id: str
    yaml_params: Optional[YamlParams] = None
    eval_slices: List[EvalSlice] = field(default_factory=list)
    summaries: Dict[str, ExplainableSummary] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.now)
    current_step: int = 0

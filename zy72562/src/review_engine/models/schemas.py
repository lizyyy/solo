from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any


class ReviewStatus(str, Enum):
    IMPORTED = "imported"
    RECALL_ADDED = "recall_added"
    ANOMALY_DETECTED = "anomaly_detected"
    PENDING_EXPERT_REVIEW = "pending_expert_review"
    EXPERT_APPROVED = "expert_approved"
    EXPERT_REJECTED = "expert_rejected"
    ARCHIVED = "archived"


class NextActionOwner(str, Enum):
    EXPERIMENT_PLATFORM = "experiment_platform_owner"
    RECOMMEND_STRATEGY = "recommend_strategy_tang"
    REVIEWER = "reviewer"
    NONE = "none"


class TimeWindowSeverity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class TimeWindowIssue:
    issue_id: str
    description: str
    severity: TimeWindowSeverity
    window_start: Optional[datetime] = None
    window_end: Optional[datetime] = None
    affected_metrics: List[str] = field(default_factory=list)
    inflated_effect_estimate: float = 0.0
    evidence_refs: List[str] = field(default_factory=list)


@dataclass
class NegativeSample:
    sample_id: str
    main_process_id: str
    main_process_name: str
    timestamp: datetime
    feature_values: Dict[str, Any] = field(default_factory=dict)
    ground_truth_label: str = "negative"
    model_prediction_score: float = 0.0
    source: str = ""
    time_window_tag: str = ""
    notes: str = ""
    imported_at: datetime = field(default_factory=datetime.now)


@dataclass
class RecallCandidate:
    candidate_id: str
    sample_id: str
    scene_description: str
    timestamp: datetime
    recall_source: str = ""
    scene_context: Dict[str, Any] = field(default_factory=dict)
    field_evidence: str = ""
    confidence_score: float = 0.0
    added_by: str = ""
    added_at: datetime = field(default_factory=datetime.now)
    notes: str = ""


@dataclass
class EvidenceMergeResult:
    merged_evidence_id: str
    negative_sample_ref: str
    recall_candidate_refs: List[str]
    combined_context: Dict[str, Any] = field(default_factory=dict)
    conflicting_points: List[str] = field(default_factory=list)
    supporting_points: List[str] = field(default_factory=list)
    summary: str = ""


@dataclass
class NextAction:
    owner: NextActionOwner
    action_description: str
    deadline_hint: str = ""
    contact_info: str = ""


@dataclass
class AnomalySample:
    anomaly_id: str
    sample_id: str
    negative_sample: NegativeSample
    recall_candidates: List[RecallCandidate] = field(default_factory=list)
    time_window_issues: List[TimeWindowIssue] = field(default_factory=list)
    evidence_merge: Optional[EvidenceMergeResult] = None
    status: ReviewStatus = ReviewStatus.IMPORTED
    why_kept: str = ""
    missing_materials: List[str] = field(default_factory=list)
    next_action: Optional[NextAction] = None
    detected_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    review_comments: List[str] = field(default_factory=list)
    tags: List[str] = field(default_factory=list)

    def has_time_window_inflation(self) -> bool:
        return len(self.time_window_issues) > 0

    def needs_expert_review(self) -> bool:
        return self.status == ReviewStatus.PENDING_EXPERT_REVIEW

    def get_owner_display(self) -> str:
        if not self.next_action:
            return "未分配"
        owner_map = {
            NextActionOwner.EXPERIMENT_PLATFORM: "实验平台负责人",
            NextActionOwner.RECOMMEND_STRATEGY: "推荐策略老唐",
            NextActionOwner.REVIEWER: "复核人",
            NextActionOwner.NONE: "无",
        }
        return owner_map.get(self.next_action.owner, "未知")


@dataclass
class ReviewRecord:
    record_id: str
    anomaly_id: str
    reviewer: str
    action: str
    comment: str
    old_status: ReviewStatus
    new_status: ReviewStatus
    timestamp: datetime = field(default_factory=datetime.now)
    attachments: List[str] = field(default_factory=list)

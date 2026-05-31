"""数据模型定义"""
from dataclasses import dataclass, field, asdict
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum


class RecordType(str, Enum):
    NORMAL = "normal"
    LATE_ATTACHMENT = "late_attachment"
    DUPLICATE = "duplicate"
    MANUAL_CORRECTION = "manual_correction"


class DisputeType(str, Enum):
    LABEL_MISSING = "label_missing"
    METRIC_CHANGE = "metric_change"
    LABEL_MISMATCH = "label_mismatch"
    DUPLICATE_CONFLICT = "duplicate_conflict"
    LATE_ATTACHMENT_ISSUE = "late_attachment_issue"
    CORRECTION_CONFLICT = "correction_conflict"
    OTHER = "other"


class DisputeStatus(str, Enum):
    OPEN = "open"
    REVIEWING = "reviewing"
    RESOLVED = "resolved"
    REJECTED = "rejected"


@dataclass
class AnnotationSample:
    """标注样本"""
    sample_id: str
    text: str
    label: str
    annotator: str
    annotated_at: datetime
    source_file: str
    source_line: int
    confidence: float = 1.0
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class EvaluationRecord:
    """评估记录"""
    eval_id: str
    sample_id: str
    predicted_label: str
    ground_truth: str
    is_correct: bool
    evaluator: str
    evaluated_at: datetime
    source_file: str
    source_line: int
    model_version: str
    metrics: Dict[str, float] = field(default_factory=dict)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class DataRecord:
    """数据记录（包含各种类型）"""
    record_id: str
    record_type: RecordType
    sample: Optional[AnnotationSample] = None
    evaluation: Optional[EvaluationRecord] = None
    parent_record_id: Optional[str] = None
    related_record_ids: List[str] = field(default_factory=list)
    received_at: Optional[datetime] = None
    note: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class EvidenceLink:
    """证据链接"""
    link_id: str
    link_type: str
    source_type: str
    source_id: str
    target_type: str
    target_id: str
    description: str = ""
    created_at: datetime = field(default_factory=datetime.now)


@dataclass
class ReviewReason:
    """复核原因"""
    reason_id: str
    dispute_id: str
    reviewer: str
    reason_type: str
    description: str
    evidence_links: List[str] = field(default_factory=list)
    metric_before: Optional[Dict[str, float]] = None
    metric_after: Optional[Dict[str, float]] = None
    created_at: datetime = field(default_factory=datetime.now)


@dataclass
class Dispute:
    """争议记录"""
    dispute_id: str
    dispute_type: DisputeType
    status: DisputeStatus
    title: str
    description: str
    record_ids: List[str] = field(default_factory=list)
    evidence_links: List[EvidenceLink] = field(default_factory=list)
    review_reasons: List[ReviewReason] = field(default_factory=list)
    conclusion: str = ""
    resolver: str = ""
    resolved_at: Optional[datetime] = None
    created_at: datetime = field(default_factory=datetime.now)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

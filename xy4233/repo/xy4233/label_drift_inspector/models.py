"""
数据模型模块 - 定义所有核心数据结构
"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Union


class SplitType(Enum):
    TRAIN = "train"
    VAL = "val"
    TEST = "test"
    UNKNOWN = "unknown"


class ReviewDecision(Enum):
    AGREE = "agree"
    DISAGREE = "disagree"
    NEED_RELABEL = "need_relabel"
    PENDING = "pending"


@dataclass
class LabelSchema:
    name: str
    version: str
    labels: Dict[str, str]
    parent_labels: Dict[str, List[str]] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.now)

    @property
    def all_labels(self) -> List[str]:
        return list(self.labels.keys())

    def validate_label(self, label: str) -> bool:
        return label in self.labels


@dataclass
class AnnotationRecord:
    session_id: str
    turn_id: Optional[str]
    text: str
    label: str
    annotator_id: str
    annotated_at: datetime
    split: SplitType = SplitType.UNKNOWN
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "session_id": self.session_id,
            "turn_id": self.turn_id,
            "text": self.text,
            "label": self.label,
            "annotator_id": self.annotator_id,
            "annotated_at": self.annotated_at.isoformat(),
            "split": self.split.value,
            "metadata": self.metadata,
        }


@dataclass
class PredictionRecord:
    session_id: str
    turn_id: Optional[str]
    predicted_label: str
    confidence: float
    model_version: str
    predicted_at: datetime
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "session_id": self.session_id,
            "turn_id": self.turn_id,
            "predicted_label": self.predicted_label,
            "confidence": self.confidence,
            "model_version": self.model_version,
            "predicted_at": self.predicted_at.isoformat(),
            "metadata": self.metadata,
        }


@dataclass
class SamplingFeedback:
    session_id: str
    turn_id: Optional[str]
    original_label: str
    reviewer_label: str
    reviewer_id: str
    is_agreement: bool
    feedback_notes: str
    reviewed_at: datetime

    def to_dict(self) -> Dict[str, Any]:
        return {
            "session_id": self.session_id,
            "turn_id": self.turn_id,
            "original_label": self.original_label,
            "reviewer_label": self.reviewer_label,
            "reviewer_id": self.reviewer_id,
            "is_agreement": self.is_agreement,
            "feedback_notes": self.feedback_notes,
            "reviewed_at": self.reviewed_at.isoformat(),
        }


@dataclass
class ReviewRecord:
    record_id: str
    session_id: str
    turn_id: Optional[str]
    annotation: AnnotationRecord
    prediction: Optional[PredictionRecord]
    sampling_feedback: Optional[SamplingFeedback]
    decision: ReviewDecision = ReviewDecision.PENDING
    final_label: Optional[str] = None
    notes: str = ""
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "record_id": self.record_id,
            "session_id": self.session_id,
            "turn_id": self.turn_id,
            "annotation": self.annotation.to_dict(),
            "prediction": self.prediction.to_dict() if self.prediction else None,
            "sampling_feedback": self.sampling_feedback.to_dict() if self.sampling_feedback else None,
            "decision": self.decision.value,
            "final_label": self.final_label,
            "notes": self.notes,
            "reviewed_by": self.reviewed_by,
            "reviewed_at": self.reviewed_at.isoformat() if self.reviewed_at else None,
        }


@dataclass
class ConsistencyMetrics:
    overall_agreement: float
    cohen_kappa: Optional[float] = None
    fleiss_kappa: Optional[float] = None
    per_label_agreement: Dict[str, float] = field(default_factory=dict)
    per_annotator_agreement: Dict[str, float] = field(default_factory=dict)


@dataclass
class AnnotatorDrift:
    annotator_id: str
    label_distribution: Dict[str, float]
    reference_distribution: Dict[str, float]
    kl_divergence: float
    js_divergence: float
    unusual_labels: List[str] = field(default_factory=list)
    drift_score: float = 0.0


@dataclass
class DataLeakage:
    session_id: str
    turn_ids: List[str]
    splits: List[str]
    severity: str
    details: str


@dataclass
class HighRiskSample:
    record_id: str
    session_id: str
    turn_id: Optional[str]
    text: str
    risk_factors: List[str]
    risk_score: float
    annotation: Optional[AnnotationRecord] = None
    prediction: Optional[PredictionRecord] = None


@dataclass
class AuditResult:
    audit_id: str
    schema_version: str
    audit_timestamp: datetime

    consistency_metrics: ConsistencyMetrics
    confusion_matrix: Dict[str, Any]

    annotator_drifts: List[AnnotatorDrift]
    data_leakages: List[DataLeakage]
    high_risk_samples: List[HighRiskSample]

    summary: Dict[str, Any] = field(default_factory=dict)
    warnings: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "audit_id": self.audit_id,
            "schema_version": self.schema_version,
            "audit_timestamp": self.audit_timestamp.isoformat(),
            "summary": self.summary,
            "warnings": self.warnings,
        }


@dataclass
class ImportValidationResult:
    is_valid: bool
    total_records: int
    valid_records: int
    invalid_records: int
    errors: List[Dict[str, Any]] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    schema_info: Optional[Dict[str, Any]] = None

from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, Dict, Any, List
from enum import Enum


class ReviewStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    REWORK = "rework"


class AnomalyType(str, Enum):
    DUPLICATE = "duplicate"
    NULL_VALUE = "null_value"
    BOUNDARY = "boundary"
    LABEL_CONFLICT = "label_conflict"
    SAMPLE_LEAKAGE = "sample_leakage"


@dataclass
class SampleRecord:
    sample_id: str
    source: str
    features: Dict[str, Any]
    created_at: datetime
    processed_at: Optional[datetime] = None
    raw_data: Optional[Dict[str, Any]] = None

    def __post_init__(self):
        if isinstance(self.created_at, str):
            self.created_at = datetime.fromisoformat(self.created_at)
        if self.processed_at and isinstance(self.processed_at, str):
            self.processed_at = datetime.fromisoformat(self.processed_at)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "sample_id": self.sample_id,
            "source": self.source,
            "features": self.features,
            "created_at": self.created_at.isoformat(),
            "processed_at": self.processed_at.isoformat() if self.processed_at else None,
            "raw_data": self.raw_data
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "SampleRecord":
        return cls(**data)


@dataclass
class ModelPrediction:
    sample_id: str
    model_version: str
    prediction: Dict[str, Any]
    score: float
    predicted_at: datetime
    metadata: Dict[str, Any] = field(default_factory=dict)

    def __post_init__(self):
        if isinstance(self.predicted_at, str):
            self.predicted_at = datetime.fromisoformat(self.predicted_at)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "sample_id": self.sample_id,
            "model_version": self.model_version,
            "prediction": self.prediction,
            "score": self.score,
            "predicted_at": self.predicted_at.isoformat(),
            "metadata": self.metadata
        }


@dataclass
class HumanReview:
    sample_id: str
    reviewer: str
    review_status: ReviewStatus
    corrected_label: Optional[Dict[str, Any]] = None
    review_comment: str = ""
    reviewed_at: datetime = field(default_factory=datetime.now)
    review_round: int = 1

    def __post_init__(self):
        if isinstance(self.reviewed_at, str):
            self.reviewed_at = datetime.fromisoformat(self.reviewed_at)
        if isinstance(self.review_status, str):
            self.review_status = ReviewStatus(self.review_status)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "sample_id": self.sample_id,
            "reviewer": self.reviewer,
            "review_status": self.review_status.value,
            "corrected_label": self.corrected_label,
            "review_comment": self.review_comment,
            "reviewed_at": self.reviewed_at.isoformat(),
            "review_round": self.review_round
        }


@dataclass
class OnlineFeedback:
    sample_id: str
    feedback_type: str
    feedback_value: Any
    feedback_source: str
    collected_at: datetime
    metadata: Dict[str, Any] = field(default_factory=dict)

    def __post_init__(self):
        if isinstance(self.collected_at, str):
            self.collected_at = datetime.fromisoformat(self.collected_at)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "sample_id": self.sample_id,
            "feedback_type": self.feedback_type,
            "feedback_value": self.feedback_value,
            "feedback_source": self.feedback_source,
            "collected_at": self.collected_at.isoformat(),
            "metadata": self.metadata
        }


@dataclass
class AnomalyRecord:
    anomaly_type: AnomalyType
    sample_id: str
    description: str
    severity: str = "warning"
    details: Dict[str, Any] = field(default_factory=dict)
    detected_at: datetime = field(default_factory=datetime.now)

    def __post_init__(self):
        if isinstance(self.anomaly_type, str):
            self.anomaly_type = AnomalyType(self.anomaly_type)
        if isinstance(self.detected_at, str):
            self.detected_at = datetime.fromisoformat(self.detected_at)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "anomaly_type": self.anomaly_type.value,
            "sample_id": self.sample_id,
            "description": self.description,
            "severity": self.severity,
            "details": self.details,
            "detected_at": self.detected_at.isoformat()
        }


@dataclass
class EvaluationRecord:
    sample_id: str
    sample: SampleRecord
    prediction: ModelPrediction
    review: Optional[HumanReview] = None
    feedback: Optional[OnlineFeedback] = None
    anomalies: List[AnomalyRecord] = field(default_factory=list)
    metrics: Dict[str, float] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "sample_id": self.sample_id,
            "sample": self.sample.to_dict(),
            "prediction": self.prediction.to_dict(),
            "review": self.review.to_dict() if self.review else None,
            "feedback": self.feedback.to_dict() if self.feedback else None,
            "anomalies": [a.to_dict() for a in self.anomalies],
            "metrics": self.metrics
        }


@dataclass
class EvaluationReport:
    model_version: str
    total_samples: int
    valid_samples: int
    metrics_summary: Dict[str, float]
    anomalies: List[AnomalyRecord]
    evaluations: List[EvaluationRecord]
    generated_at: datetime = field(default_factory=datetime.now)
    source: str = "cold_start_eval"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "model_version": self.model_version,
            "total_samples": self.total_samples,
            "valid_samples": self.valid_samples,
            "metrics_summary": self.metrics_summary,
            "anomalies": [a.to_dict() for a in self.anomalies],
            "evaluations": [e.to_dict() for e in self.evaluations],
            "generated_at": self.generated_at.isoformat(),
            "source": self.source
        }

from __future__ import annotations

import enum
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional


class DecisionSource(enum.Enum):
    MODEL = "model"
    HUMAN_CORRECTION = "human_correction"
    NEEDS_REVIEW = "needs_review"


class ReviewStatus(enum.Enum):
    MODEL_APPROVED = "model_approved"
    HUMAN_CORRECTED = "human_corrected"
    NEEDS_REVIEW = "needs_review"


class WarningType(enum.Enum):
    DUPLICATE_SAMPLE = "duplicate_sample"
    MISSING_REFERENCE = "missing_reference"
    LABEL_CONFLICT = "label_conflict"
    SAMPLE_LEAKAGE = "sample_leakage"
    NULL_FEATURE = "null_feature"


@dataclass
class SampleRecord:
    sample_id: str
    features: Dict[str, Any]
    reference_result: Optional[str] = None
    original_label: Optional[str] = None
    human_label: Optional[str] = None
    group_id: Optional[str] = None
    source: Optional[str] = None
    created_at: Optional[str] = None


@dataclass
class ReviewDecision:
    sample_id: str
    decision_source: DecisionSource
    decided_label: str
    model_version: Optional[str] = None
    threshold: Optional[float] = None
    evidence: Optional[Dict[str, Any]] = None
    human_operator: Optional[str] = None
    human_reason: Optional[str] = None
    decided_at: str = field(default_factory=lambda: datetime.now().isoformat())
    original_label: Optional[str] = None
    reference_result: Optional[str] = None


@dataclass
class DataQualityWarning:
    warning_type: WarningType
    sample_ids: List[str]
    detail: str
    detected_at: str = field(default_factory=lambda: datetime.now().isoformat())


@dataclass
class SampleReviewResult:
    sample: SampleRecord
    decision: ReviewDecision
    status: ReviewStatus
    warnings: List[DataQualityWarning] = field(default_factory=list)


@dataclass
class ReviewSession:
    session_id: str
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    model_version: str = "v1.0.0"
    threshold: float = 0.5
    decisions: List[ReviewDecision] = field(default_factory=list)
    warnings: List[DataQualityWarning] = field(default_factory=list)
    sample_results: List[SampleReviewResult] = field(default_factory=list)


@dataclass
class ReviewReport:
    session: ReviewSession
    model_approved_count: int = 0
    human_corrected_count: int = 0
    needs_review_count: int = 0
    total_count: int = 0
    warnings_summary: List[Dict[str, Any]] = field(default_factory=list)
    sample_details: List[Dict[str, Any]] = field(default_factory=list)
    generated_at: str = field(default_factory=lambda: datetime.now().isoformat())

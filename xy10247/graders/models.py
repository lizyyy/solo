from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional, Any


class SeverityLevel(Enum):
    MILD = "轻度"
    MODERATE = "中度"
    SEVERE = "严重"
    CRITICAL = "极严重"


class ReviewStatus(Enum):
    PENDING = "待复核"
    APPROVED = "已确认"
    REJECTED = "已驳回"
    MODIFIED = "已修正"


@dataclass
class Sample:
    sample_id: str
    leaf_area_cm2: float
    lesion_area_cm2: float
    lesion_color: str
    collected_at: str
    technician_id: str
    field_id: str
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ColorFeature:
    r: float
    g: float
    b: float
    h: float
    s: float
    v: float
    color_category: str
    brown_index: float
    yellow_index: float


@dataclass
class AreaFeature:
    lesion_area_cm2: float
    leaf_area_cm2: float
    lesion_ratio: float


@dataclass
class ExtractedFeatures:
    sample_id: str
    area_features: AreaFeature
    color_features: ColorFeature
    extracted_at: str


@dataclass
class RuleResult:
    grade: SeverityLevel
    score: float
    rules_applied: List[str]
    explanation: str


@dataclass
class ReviewInfo:
    reviewer_id: Optional[str] = None
    reviewed_at: Optional[str] = None
    final_grade: Optional[SeverityLevel] = None
    comment: Optional[str] = None


@dataclass
class SampleResult:
    sample_id: str
    raw_sample: Sample
    features: Optional[ExtractedFeatures] = None
    rule_grade: Optional[RuleResult] = None
    review_status: ReviewStatus = ReviewStatus.PENDING
    review_info: Optional[ReviewInfo] = None
    final_grade: Optional[SeverityLevel] = None
    processed_at: Optional[str] = None
    version: int = 1


@dataclass
class ProcessingState:
    batch_id: str
    processed_at: str
    total_samples: int
    processed_samples: int
    pending_review: int
    approved: int
    rejected: int
    modified: int


@dataclass
class ExportResult:
    export_path: str
    batch_id: str
    exported_at: str
    sample_count: int
    has_review_data: bool

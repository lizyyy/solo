from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional, Dict, Any
from enum import Enum


class BucketDiff(str, Enum):
    SAME = "same"
    ONE_BUCKET = "one_bucket"
    MULTI_BUCKET = "multi_bucket"


class Status(str, Enum):
    PENDING_REVIEW = "pending_review"
    REVIEWED_BY_OP = "reviewed_by_op"
    SUPPLEMENTED_BY_ALGO = "supplemented_by_algo"
    CONFIRMED_NORMAL = "confirmed_normal"
    NEEDS_INVESTIGATION = "needs_investigation"


class NextOwner(str, Enum):
    OPERATION = "operation"
    ALGORITHM = "algorithm"
    BOTH = "both"


@dataclass
class NegativeSample:
    sample_id: str
    offline_score: float
    online_score: float
    offline_bucket: int
    online_bucket: int
    bucket_diff: BucketDiff
    features: Dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.now)
    source: str = ""


@dataclass
class RecallCandidate:
    sample_id: str
    candidate_id: str
    rank: int
    score: float
    is_related: bool = False
    reason: str = ""
    supplemented_by: str = ""
    supplemented_at: Optional[datetime] = None


@dataclass
class DriftRecord:
    record_id: str
    sample_id: str
    offline_bucket: int
    online_bucket: int
    bucket_diff: BucketDiff
    offline_score: float
    online_score: float
    status: Status = Status.PENDING_REVIEW
    review_notes: str = ""
    why_kept: str = ""
    missing_materials: List[str] = field(default_factory=list)
    next_owner: NextOwner = NextOwner.OPERATION
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    recall_candidates: List[RecallCandidate] = field(default_factory=list)


@dataclass
class ExperimentComparison:
    experiment_id: str
    experiment_name: str
    drift_records: List[DriftRecord] = field(default_factory=list)
    baseline_version: str = ""
    current_version: str = ""
    created_at: datetime = field(default_factory=datetime.now)
    notes: str = ""


@dataclass
class BucketConfig:
    boundaries: List[float]
    labels: List[str] = field(default_factory=list)

    def get_bucket(self, score: float) -> int:
        for i, boundary in enumerate(self.boundaries):
            if score < boundary:
                return i
        return len(self.boundaries)

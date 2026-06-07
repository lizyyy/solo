from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict


class ScoreBucket(str, Enum):
    BUCKET_0 = "0-0.2"
    BUCKET_1 = "0.2-0.4"
    BUCKET_2 = "0.4-0.6"
    BUCKET_3 = "0.6-0.8"
    BUCKET_4 = "0.8-1.0"

    @classmethod
    def from_score(cls, score: float) -> "ScoreBucket":
        if score < 0.2:
            return cls.BUCKET_0
        elif score < 0.4:
            return cls.BUCKET_1
        elif score < 0.6:
            return cls.BUCKET_2
        elif score < 0.8:
            return cls.BUCKET_3
        else:
            return cls.BUCKET_4

    def bucket_index(self) -> int:
        return [
            ScoreBucket.BUCKET_0,
            ScoreBucket.BUCKET_1,
            ScoreBucket.BUCKET_2,
            ScoreBucket.BUCKET_3,
            ScoreBucket.BUCKET_4,
        ].index(self)

    def bucket_diff(self, other: "ScoreBucket") -> int:
        return abs(self.bucket_index() - other.bucket_index())


class RecordStatus(str, Enum):
    IMPORTED = "已导入"
    BUCKET_MISMATCH = "分桶不一致"
    FEATURE_MISSING = "缺特征快照"
    FEATURE_FILLED = "特征已补录"
    COMPARISON_UPDATED = "对比已更新"
    PENDING_REVIEW = "待评测运营复核"
    REVIEW_PASSED = "复核通过"
    REVIEW_REJECTED = "复核驳回"
    RE_RUN = "已重跑"
    MANUAL_CORRECTED = "已人工修正"


@dataclass
class EvaluationSlice:
    slice_id: str
    name: str
    offline_score: float
    online_score: float
    query_count: int
    imported_at: datetime = field(default_factory=datetime.now)
    tags: List[str] = field(default_factory=list)

    @property
    def offline_bucket(self) -> ScoreBucket:
        return ScoreBucket.from_score(self.offline_score)

    @property
    def online_bucket(self) -> ScoreBucket:
        return ScoreBucket.from_score(self.online_score)

    @property
    def bucket_diff(self) -> int:
        return self.offline_bucket.bucket_diff(self.online_bucket)

    @property
    def has_bucket_mismatch(self) -> bool:
        return self.bucket_diff >= 1


@dataclass
class FeatureSnapshot:
    snapshot_id: str
    slice_id: str
    feature_version: str
    indexed_at: datetime
    vector_dim: int
    index_type: str
    remark: str = ""


@dataclass
class CorrectionLog:
    timestamp: datetime
    operator: str
    action: str
    before: str
    after: str
    reason: str


@dataclass
class ExperimentComparison:
    comparison_id: str
    slice_id: str
    feature_snapshot_id: Optional[str] = None
    baseline_offline_score: Optional[float] = None
    baseline_online_score: Optional[float] = None
    current_offline_score: Optional[float] = None
    current_online_score: Optional[float] = None
    offline_delta: Optional[float] = None
    online_delta: Optional[float] = None
    conclusion: str = ""
    generated_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


@dataclass
class AcceptanceRecord:
    record_id: str
    slice: EvaluationSlice
    status: RecordStatus = RecordStatus.IMPORTED
    feature_snapshot: Optional[FeatureSnapshot] = None
    comparisons: List[ExperimentComparison] = field(default_factory=list)
    correction_logs: List[CorrectionLog] = field(default_factory=list)
    assignee: Optional[str] = None
    next_step: str = ""
    missing_materials: List[str] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)

    def update_status(self, status: RecordStatus, operator: str = "system"):
        self.status = status
        self.updated_at = datetime.now()

    def add_correction(self, operator: str, action: str, before: str, after: str, reason: str):
        log = CorrectionLog(
            timestamp=datetime.now(),
            operator=operator,
            action=action,
            before=before,
            after=after,
            reason=reason,
        )
        self.correction_logs.append(log)

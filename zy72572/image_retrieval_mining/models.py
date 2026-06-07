from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import List, Optional, Dict, Any


class BucketType(str, Enum):
    A = "A"
    B = "B"
    C = "C"
    D = "D"
    E = "E"
    UNKNOWN = "UNKNOWN"

    @classmethod
    def from_score(cls, score: float) -> "BucketType":
        if score >= 0.9:
            return cls.A
        elif score >= 0.8:
            return cls.B
        elif score >= 0.7:
            return cls.C
        elif score >= 0.6:
            return cls.D
        else:
            return cls.E


class RecordStatus(str, Enum):
    NORMAL = "正常"
    BUCKET_DIFF = "离线线上分桶差"
    PENDING_REVIEW = "待评测运营复核"
    OLD_CALIBER = "旧口径(来自阈值调参笔记)"
    MANUAL_FIXED = "人工修正"
    RERUN = "重跑"


@dataclass
class TrainingLogPoint:
    step: int
    train_loss: float
    val_mAP: float
    timestamp: datetime = field(default_factory=datetime.now)


@dataclass
class TrainingLog:
    log_id: str
    experiment_name: str
    points: List[TrainingLogPoint] = field(default_factory=list)
    model_version: str = ""
    created_at: datetime = field(default_factory=datetime.now)
    imported: bool = False


@dataclass
class ThresholdNote:
    note_id: str
    record_id: str
    old_offline_score: Optional[float] = None
    old_online_score: Optional[float] = None
    new_offline_score: Optional[float] = None
    new_online_score: Optional[float] = None
    caliber_note: str = ""
    operator: str = ""
    created_at: datetime = field(default_factory=datetime.now)
    applied: bool = False


@dataclass
class RetrievalRecord:
    record_id: str
    image_id: str
    query: str
    offline_score: float
    online_score: float
    offline_bucket: BucketType = BucketType.UNKNOWN
    online_bucket: BucketType = BucketType.UNKNOWN
    status: RecordStatus = RecordStatus.NORMAL
    bucket_diff: bool = False
    training_log_id: Optional[str] = None
    threshold_note_id: Optional[str] = None
    remark: str = ""
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)

    def __post_init__(self):
        self.offline_bucket = BucketType.from_score(self.offline_score)
        self.online_bucket = BucketType.from_score(self.online_score)
        self.bucket_diff = self.offline_bucket != self.online_bucket
        if self.bucket_diff and self.status == RecordStatus.NORMAL:
            self.status = RecordStatus.BUCKET_DIFF


@dataclass
class ExperimentComparison:
    comparison_id: str
    baseline_record_id: str
    compared_record_id: str
    baseline_offline_score: float
    baseline_online_score: float
    compared_offline_score: float
    compared_online_score: float
    offline_delta: float = 0.0
    online_delta: float = 0.0
    note: str = ""
    created_at: datetime = field(default_factory=datetime.now)

    def __post_init__(self):
        self.offline_delta = self.compared_offline_score - self.baseline_offline_score
        self.online_delta = self.compared_online_score - self.baseline_online_score


@dataclass
class MiningResult:
    total_count: int = 0
    normal_count: int = 0
    bucket_diff_count: int = 0
    pending_review_count: int = 0
    old_caliber_count: int = 0
    manual_fixed_count: int = 0
    rerun_count: int = 0
    records: List[RetrievalRecord] = field(default_factory=list)
    comparisons: List[ExperimentComparison] = field(default_factory=list)
    threshold_notes_applied: int = 0
    generated_at: datetime = field(default_factory=datetime.now)

    def summary(self) -> Dict[str, Any]:
        return {
            "总记录数": self.total_count,
            "正常记录": self.normal_count,
            "离线线上分桶差": self.bucket_diff_count,
            "待复核": self.pending_review_count,
            "旧口径记录": self.old_caliber_count,
            "人工修正": self.manual_fixed_count,
            "重跑记录": self.rerun_count,
            "已应用阈值笔记": self.threshold_notes_applied,
        }

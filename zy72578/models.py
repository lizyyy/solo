from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple
from enum import Enum
from datetime import datetime


class MaterialType(Enum):
    NORMAL = "正常材料"
    WRONG_CALIBER = "错口径材料"
    SUPPLEMENT = "补录材料"


class WorkflowStep(Enum):
    STEP1_THRESHOLD_IMPORT = "阈值调参笔记第一次导入"
    STEP2_TANG_REVIEW = "推荐策略老唐补看线上实验桶"
    STEP3_THRESHOLD_UPDATE = "阈值回放更新"
    COMPLETED = "已完成"


class ReviewStatus(Enum):
    PENDING = "待复核"
    CONFIRMED = "已确认"
    REJECTED = "已驳回"
    NEED_ALGORITHM_REVIEW = "需算法工程师复核"


@dataclass
class ThresholdNote:
    note_id: str
    model_name: str
    threshold: float
    minority_threshold: Optional[float] = None
    created_at: datetime = field(default_factory=datetime.now)
    imported_by: str = "unknown"


@dataclass
class OnlineExperimentBucket:
    bucket_id: str
    model_name: str
    threshold: float
    minority_threshold: Optional[float] = None
    sample_count: int = 0
    minority_sample_count: int = 0
    overall_metric: float = 0.0
    minority_metric: float = 0.0
    created_at: datetime = field(default_factory=datetime.now)


@dataclass
class Material:
    material_id: str
    material_type: MaterialType
    model_name: str
    threshold_notes: List[ThresholdNote] = field(default_factory=list)
    experiment_buckets: List[OnlineExperimentBucket] = field(default_factory=list)
    imported_at: datetime = field(default_factory=datetime.now)
    is_duplicate: bool = False


@dataclass
class ConflictEvidence:
    model_name: str
    threshold_note_value: float
    experiment_bucket_value: float
    threshold_note_id: str
    experiment_bucket_id: str
    description: str


@dataclass
class SelfCheckResult:
    check_name: str
    passed: bool
    message: str
    details: Dict = field(default_factory=dict)


@dataclass
class VotingResult:
    model_name: str
    final_threshold: float
    final_minority_threshold: Optional[float]
    confidence: float
    is_minority_masked: bool = False
    review_status: ReviewStatus = ReviewStatus.PENDING
    conflict_evidences: List[ConflictEvidence] = field(default_factory=list)
    self_check_results: List[SelfCheckResult] = field(default_factory=list)
    workflow_step: WorkflowStep = WorkflowStep.STEP1_THRESHOLD_IMPORT

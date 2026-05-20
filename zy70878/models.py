from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import List, Optional, Dict, Any


class AdmissionStatus(Enum):
    PENDING = "待审核"
    APPROVED = "已放行"
    REJECTED = "已退回"
    SUPPLEMENT = "需补材料"
    CONFLICT = "存在冲突"


class AdjustmentType(Enum):
    FIRST_CHOICE = "第一志愿"
    SECOND_CHOICE = "第二志愿"
    ADJUSTMENT_BATCH_1 = "调剂第一批"
    ADJUSTMENT_BATCH_2 = "调剂第二批"
    ADJUSTMENT_BATCH_3 = "调剂第三批"


class ConflictType(Enum):
    QUOTA_EXCEEDED = "导师名额超额"
    CROSS_MAJOR = "跨专业限制"
    DUPLICATE_ADMISSION = "重复录取"
    MAJOR_MISMATCH = "专业不匹配"


@dataclass
class Supervisor:
    id: str
    name: str
    department: str
    major: str
    title: str
    total_quota: int
    used_quota: int = 0
    remaining_quota: int = field(init=False)

    def __post_init__(self):
        self.remaining_quota = self.total_quota - self.used_quota


@dataclass
class Student:
    id: str
    name: str
    id_card: str
    undergraduate_major: str
    undergraduate_school: str
    application_major: str
    total_score: float
    exam_score: float
    interview_score: float


@dataclass
class ApplicationChoice:
    student_id: str
    supervisor_id: str
    preference_order: int
    is_cross_major: bool


@dataclass
class AdjustmentRecord:
    id: str
    student_id: str
    from_supervisor_id: Optional[str]
    to_supervisor_id: str
    adjustment_batch: AdjustmentType
    adjustment_time: datetime
    operator: str
    reason: str
    source_batch: Optional[str] = None


@dataclass
class ConflictDetail:
    conflict_type: ConflictType
    description: str
    source: Dict[str, Any]
    severity: str = "high"


@dataclass
class ReviewRecord:
    id: str
    reconciliation_id: str
    reviewer: str
    review_time: datetime
    original_status: AdmissionStatus
    new_status: AdmissionStatus
    comment: str


@dataclass
class ReconciliationItem:
    id: str
    student_id: str
    student_name: str
    supervisor_id: str
    supervisor_name: str
    application_type: AdjustmentType
    status: AdmissionStatus
    conflicts: List[ConflictDetail] = field(default_factory=list)
    review_records: List[ReviewRecord] = field(default_factory=list)
    is_approved: bool = False
    source_trace: List[Dict[str, Any]] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)


@dataclass
class ReconciliationSummary:
    total_records: int = 0
    pending_count: int = 0
    approved_count: int = 0
    rejected_count: int = 0
    supplement_count: int = 0
    conflict_count: int = 0
    quota_warnings: List[Dict[str, Any]] = field(default_factory=list)
    cross_major_count: int = 0
    duplicate_count: int = 0


@dataclass
class ReconciliationSession:
    id: str
    name: str
    created_at: datetime
    created_by: str
    supervisors: Dict[str, Supervisor] = field(default_factory=dict)
    students: Dict[str, Student] = field(default_factory=dict)
    choices: List[ApplicationChoice] = field(default_factory=list)
    adjustments: List[AdjustmentRecord] = field(default_factory=list)
    items: Dict[str, ReconciliationItem] = field(default_factory=dict)
    summary: ReconciliationSummary = field(default_factory=ReconciliationSummary)
    is_locked: bool = False

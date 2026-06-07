"""数据模型定义"""

from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any
from enum import Enum
from datetime import datetime


class RecordStatus(str, Enum):
    """记录处理状态"""
    PENDING = "pending"
    IMPORTED = "imported"
    REVIEW_REQUIRED = "review_required"
    REVIEWED = "reviewed"
    CONFIRMED = "confirmed"
    REJECTED = "rejected"


class IssueType(str, Enum):
    """问题类型"""
    NORMAL = "normal"
    DUPLICATE_USER_FEEDBACK = "duplicate_user_feedback"
    DUPLICATE_IMPORT = "duplicate_import"
    DATA_INCONSISTENCY = "data_inconsistency"


@dataclass
class ModelOutputFragment:
    """模型输出片段 - 保留原始证据"""
    record_id: str
    raw_line_number: int
    user_feedback_id: str
    user_id: str
    kb_link: str
    link_status: str
    confidence: float
    raw_content: Dict[str, Any]
    import_timestamp: datetime = field(default_factory=datetime.now)
    import_batch_id: str = ""


@dataclass
class ManualJudgment:
    """人工改判记录"""
    judgment_id: str
    record_id: str
    user_feedback_id: str
    user_id: str
    judge_name: str
    judgment_result: str
    judgment_reason: str
    judgment_timestamp: datetime
    raw_line_number: int
    raw_content: Dict[str, Any]


@dataclass
class EvidenceLog:
    """证据日志 - 记录每一次变更"""
    log_id: str
    record_id: str
    action: str
    operator: str
    before_status: Optional[RecordStatus]
    after_status: RecordStatus
    reason: str
    timestamp: datetime = field(default_factory=datetime.now)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class TrackingRecord:
    """追踪主记录 - 统一数据源"""
    record_id: str
    user_feedback_id: str
    user_id: str
    kb_link: str
    initial_model_fragment: ModelOutputFragment
    manual_judgments: List[ManualJudgment] = field(default_factory=list)
    evidence_logs: List[EvidenceLog] = field(default_factory=list)
    status: RecordStatus = RecordStatus.PENDING
    issue_type: IssueType = IssueType.NORMAL
    issue_note: str = ""
    current_link_status: str = ""
    review_by: Optional[str] = None
    review_reason: Optional[str] = None
    review_timestamp: Optional[datetime] = None
    is_duplicate_user_feedback: bool = False
    duplicate_group_id: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "record_id": self.record_id,
            "user_feedback_id": self.user_feedback_id,
            "user_id": self.user_id,
            "kb_link": self.kb_link,
            "status": self.status.value,
            "issue_type": self.issue_type.value,
            "issue_note": self.issue_note,
            "current_link_status": self.current_link_status,
            "review_by": self.review_by,
            "review_reason": self.review_reason,
            "review_timestamp": self.review_timestamp.isoformat() if self.review_timestamp else None,
            "is_duplicate_user_feedback": self.is_duplicate_user_feedback,
            "duplicate_group_id": self.duplicate_group_id,
            "raw_line_number": self.initial_model_fragment.raw_line_number,
            "import_batch_id": self.initial_model_fragment.import_batch_id,
            "confidence": self.initial_model_fragment.confidence,
            "manual_judgment_count": len(self.manual_judgments),
            "evidence_log_count": len(self.evidence_logs),
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }


@dataclass
class ProcessingResult:
    """处理结果"""
    total_records: int = 0
    normal_count: int = 0
    duplicate_user_feedback_count: int = 0
    duplicate_import_count: int = 0
    review_required_count: int = 0
    reviewed_count: int = 0
    issues: List[Dict[str, Any]] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)
    export_consistent: bool = True
    data_source: str = "unified"

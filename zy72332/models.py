from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import List, Optional, Dict, Any
import uuid


class RecordStatus(str, Enum):
    """记录状态"""
    IMPORTED = "已导入"
    DUPLICATE_DETECTED = "检测到重复答案"
    PENDING_REVIEW = "待业务运营复核"
    ANNOTATED = "已补录批注"
    NORMAL = "正常"
    MANUAL_CORRECTED = "人工修正"
    RE_RUN = "重跑完成"
    OLD_STANDARD = "旧口径"


class ProcessingType(str, Enum):
    """处理类型"""
    SMOOTH = "顺利记录"
    DUPLICATE = "同一学生两版答案"
    OLD_STANDARD_SUPPLEMENT = "老师批注补录旧口径"


@dataclass
class ScreenshotReference:
    """旧公式截图引用"""
    screenshot_id: str
    file_path: str
    description: str
    imported_at: datetime
    formula_text: Optional[str] = None


@dataclass
class StudentAnswer:
    """学生答案"""
    answer_id: str
    student_id: str
    student_name: str
    submission_time: datetime
    content: Dict[str, Any]
    version: int = 1
    is_duplicate: bool = False


@dataclass
class TeacherAnnotation:
    """老师批注"""
    annotation_id: str
    teacher_name: str
    content: str
    annotated_at: datetime
    old_standard_reference: Optional[str] = None
    error_explanation_update: Optional[str] = None


@dataclass
class ErrorExplanation:
    """误差说明"""
    current_text: str
    history: List[Dict[str, Any]] = field(default_factory=list)
    last_updated_at: Optional[datetime] = None
    updated_by: Optional[str] = None

    def update(self, new_text: str, updated_by: str, annotation_ref: Optional[str] = None):
        self.history.append({
            "old_text": self.current_text,
            "new_text": new_text,
            "updated_by": updated_by,
            "updated_at": datetime.now(),
            "annotation_ref": annotation_ref
        })
        self.current_text = new_text
        self.last_updated_at = datetime.now()
        self.updated_by = updated_by


@dataclass
class StoreGroupingRecord:
    """门店分群记录"""
    record_id: str
    store_id: str
    store_name: str
    processing_type: ProcessingType
    student_answers: List[StudentAnswer] = field(default_factory=list)
    annotations: List[TeacherAnnotation] = field(default_factory=list)
    screenshot_refs: List[ScreenshotReference] = field(default_factory=list)
    error_explanation: ErrorExplanation = field(default_factory=lambda: ErrorExplanation(current_text="初始导入，待分析"))
    status: RecordStatus = RecordStatus.IMPORTED
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    final_group: Optional[str] = None
    manual_correction_note: Optional[str] = None
    re_run_count: int = 0
    operation_log: List[Dict[str, Any]] = field(default_factory=list)

    def log_operation(self, operation: str, operator: str, details: Optional[Dict[str, Any]] = None):
        self.operation_log.append({
            "timestamp": datetime.now(),
            "operation": operation,
            "operator": operator,
            "details": details or {}
        })
        self.updated_at = datetime.now()

    def has_duplicate_answers(self) -> bool:
        return len([a for a in self.student_answers if a.is_duplicate]) > 0

    def get_duplicate_answers(self) -> List[StudentAnswer]:
        return [a for a in self.student_answers if a.is_duplicate]


@dataclass
class GroupingResult:
    """分群结果"""
    record_id: str
    store_id: str
    final_group: str
    confidence: float
    processing_type: ProcessingType
    status: RecordStatus
    error_explanation: str
    generated_at: datetime
    reviewed_by: Optional[str] = None


@dataclass
class AuditTrail:
    """复盘记录"""
    trail_id: str
    record_id: str
    events: List[Dict[str, Any]] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)

    def add_event(self, event_type: str, description: str, actor: str, data: Optional[Dict[str, Any]] = None):
        self.events.append({
            "timestamp": datetime.now(),
            "event_type": event_type,
            "description": description,
            "actor": actor,
            "data": data or {}
        })

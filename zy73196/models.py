from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any


class ReviewStatus(Enum):
    DRAFT = "草稿"
    SUBMITTED = "已提交"
    UNDER_REVIEW = "复核中"
    APPROVED = "通过"
    REJECTED = "不通过"
    REVISED = "改判"
    WITHDRAWN = "已撤回"


class InputType(Enum):
    NORMAL = "正常输入"
    DRAFT = "学生草稿"
    EMPTY_SET = "空集合"
    MISSING_UNIT = "单位缺失"
    ANOMALY = "异常输入"


@dataclass
class BoundaryParams:
    tolerance: float = 0.01
    min_value: float = 0.0
    max_value: float = 100.0
    unit_required: bool = True
    strict_mode: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return {
            "tolerance": self.tolerance,
            "min_value": self.min_value,
            "max_value": self.max_value,
            "unit_required": self.unit_required,
            "strict_mode": self.strict_mode,
        }


@dataclass
class StudentWork:
    id: str
    student_name: str
    problem_id: str
    answer: Any
    unit: Optional[str] = None
    is_draft: bool = False
    raw_content: str = ""

    def detect_input_type(self, params: BoundaryParams) -> InputType:
        if self.answer is None or (isinstance(self.answer, list) and len(self.answer) == 0):
            return InputType.EMPTY_SET
        if self.is_draft:
            return InputType.DRAFT
        if params.unit_required and not self.unit:
            return InputType.MISSING_UNIT
        return InputType.NORMAL


@dataclass
class ReviewHistory:
    id: str
    work_id: str
    reviewer: str
    old_status: Optional[ReviewStatus]
    new_status: ReviewStatus
    reason: str
    source: str
    timestamp: datetime = field(default_factory=datetime.now)
    params_snapshot: Optional[Dict[str, Any]] = None
    notes: Optional[str] = None


@dataclass
class ReviewRecord:
    work_id: str
    work: StudentWork
    current_status: ReviewStatus = ReviewStatus.SUBMITTED
    history: List[ReviewHistory] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    current_params: BoundaryParams = field(default_factory=BoundaryParams)
    last_calc_result: Optional[Dict[str, Any]] = None
    anomaly_flags: List[str] = field(default_factory=list)
    supplementary_notes: List[str] = field(default_factory=list)
    withdrawal_record: Optional[Dict[str, Any]] = None

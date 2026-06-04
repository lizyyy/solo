"""核心数据模型"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import List, Optional, Dict, Any


class RecordStatus(str, Enum):
    """记录状态"""
    PENDING = "pending"
    NORMAL = "normal"
    BOUNDARY = "boundary"
    ABNORMAL = "abnormal"
    NEED_REVIEW = "need_review"
    MANUAL_FIXED = "manual_fixed"
    RERUN = "rerun"


class DataSource(str, Enum):
    """数据来源"""
    INITIAL_IMPORT = "initial_import"
    OLD_FORMULA = "old_formula"
    MANUAL_ADD = "manual_add"


@dataclass
class WeightRule:
    """评分权重规则"""
    score_range: str
    weight: float
    threshold: float
    description: str = ""


@dataclass
class SampleRecord:
    """样本记录"""
    record_id: str
    course_name: str
    teacher_name: str
    sample_size: int
    pass_count: int
    pass_rate: float
    score: float
    ci_lower: float = 0.0
    ci_upper: float = 0.0
    weight: float = 0.0
    status: RecordStatus = RecordStatus.PENDING
    boundary_equal_to_threshold: bool = False
    data_source: DataSource = DataSource.INITIAL_IMPORT
    formula_version: str = "v2"
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    review_note: str = ""
    fix_history: List[Dict[str, Any]] = field(default_factory=list)

    @property
    def is_boundary_case(self) -> bool:
        return self.boundary_equal_to_threshold

    def mark_boundary(self, note: str = ""):
        """标记为边界值等于阈值，等待任课老师复核"""
        self.status = RecordStatus.NEED_REVIEW
        self.boundary_equal_to_threshold = True
        self.review_note = note or "边界值刚好等于阈值，待任课老师复核"
        self.updated_at = datetime.now()

    def manual_fix(self, operator: str, new_status: RecordStatus, note: str):
        """人工修正"""
        self.fix_history.append({
            "before": self.status.value,
            "after": new_status.value,
            "operator": operator,
            "note": note,
            "timestamp": datetime.now().isoformat()
        })
        self.status = new_status
        self.updated_at = datetime.now()
        self.review_note = note


@dataclass
class CounterExample:
    """反例记录"""
    case_id: str
    record_id: str
    course_name: str
    issue_type: str
    description: str
    formula_version: str
    evidence: str = ""
    created_at: datetime = field(default_factory=datetime.now)
    resolved: bool = False
    resolved_note: str = ""


@dataclass
class OldFormulaScreenshot:
    """旧公式截图记录"""
    screenshot_id: str
    record_id: str
    course_name: str
    image_path: str
    old_pass_rate: float
    old_threshold: float
    old_formula_text: str
    uploaded_by: str
    uploaded_at: datetime = field(default_factory=datetime.now)
    processed: bool = False
    linked_counter_example_id: Optional[str] = None


@dataclass
class WeightTable:
    """评分权重表"""
    table_id: str
    name: str
    version: str
    rules: List[WeightRule]
    effective_date: datetime
    created_at: datetime = field(default_factory=datetime.now)
    is_active: bool = False

    def find_rule(self, score: float) -> Optional[WeightRule]:
        """根据分数找到对应的权重规则"""
        for rule in self.rules:
            low, high = map(float, rule.score_range.split("-"))
            if low <= score <= high:
                return rule
        return None

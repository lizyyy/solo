"""数据模型定义"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional, Dict, Any, List


class ProcessingStatus(str, Enum):
    """处理状态枚举"""
    IMPORTED = "imported"
    PENDING_REVIEW = "pending_review"
    REVIEWED = "reviewed"
    REVISED = "revised"
    FINALIZED = "finalized"
    ROLLED_BACK = "rolled_back"


class BoundaryType(str, Enum):
    """边界样本类型"""
    NORMAL = "normal"
    NEGATIVE_VALUE = "negative_value"
    MISSING_VALUE = "missing_value"
    NEGATIVE_TREATED_AS_MISSING = "negative_treated_as_missing"
    OUTLIER = "outlier"


class ChangeSource(str, Enum):
    """变更来源"""
    INITIAL_IMPORT = "initial_import"
    BOUNDARY_DETECTION = "boundary_detection"
    MANUAL_EDIT = "manual_edit"
    TA_REVIEW = "ta_review"
    ROLLBACK = "rollback"
    RE_IMPORT = "re_import"


@dataclass
class RatingWeightRecord:
    """评分权重表记录 - 保留原始行号、人工改动、处理状态"""
    id: Optional[int] = None
    import_batch_id: Optional[int] = None
    original_row_number: int = 0
    raw_data: Dict[str, Any] = field(default_factory=dict)
    current_data: Dict[str, Any] = field(default_factory=dict)
    position: str = ""
    weight_p10: Optional[float] = None
    weight_p25: Optional[float] = None
    weight_p50: Optional[float] = None
    weight_p75: Optional[float] = None
    weight_p90: Optional[float] = None
    sample_count: Optional[int] = None
    boundary_type: BoundaryType = BoundaryType.NORMAL
    status: ProcessingStatus = ProcessingStatus.IMPORTED
    remark: str = ""
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    created_by: str = "system"
    updated_by: str = "system"


@dataclass
class RecordHistory:
    """历史变更记录 - 用于追踪改前改后差别"""
    id: Optional[int] = None
    record_id: int = 0
    change_source: ChangeSource = ChangeSource.MANUAL_EDIT
    field_name: str = ""
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    old_status: Optional[ProcessingStatus] = None
    new_status: Optional[ProcessingStatus] = None
    snapshot_before: Dict[str, Any] = field(default_factory=dict)
    snapshot_after: Dict[str, Any] = field(default_factory=dict)
    changed_by: str = ""
    change_reason: str = ""
    changed_at: datetime = field(default_factory=datetime.now)


@dataclass
class ImportBatch:
    """导入批次 - 用于去重，防止重复导入数量翻倍"""
    id: Optional[int] = None
    file_hash: str = ""
    file_name: str = ""
    record_count: int = 0
    imported_at: datetime = field(default_factory=datetime.now)
    imported_by: str = ""
    is_deduplicated: bool = False
    deduplication_note: str = ""


@dataclass
class ReviewTask:
    """学生助教复核任务"""
    id: Optional[int] = None
    record_id: int = 0
    boundary_type: BoundaryType = BoundaryType.NEGATIVE_TREATED_AS_MISSING
    assigned_to: str = ""
    review_note: str = ""
    review_result: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    is_completed: bool = False
    created_at: datetime = field(default_factory=datetime.now)


@dataclass
class BoundaryReport:
    """边界样本报告"""
    id: Optional[int] = None
    batch_id: int = 0
    generated_at: datetime = field(default_factory=datetime.now)
    total_records: int = 0
    boundary_records: int = 0
    negative_values: int = 0
    missing_values: int = 0
    negative_as_missing: int = 0
    pending_review_count: int = 0
    report_content: Dict[str, Any] = field(default_factory=dict)


@dataclass
class WorkflowState:
    """工作流程状态 - 追踪三步流程进度"""
    id: Optional[int] = None
    batch_id: int = 0
    step_import_completed: bool = False
    step_formula_review_completed: bool = False
    step_boundary_report_completed: bool = False
    current_step: int = 1
    formula_screenshot_reviewed: bool = False
    formula_review_note: str = ""
    last_updated_at: datetime = field(default_factory=datetime.now)

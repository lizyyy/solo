from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Dict, Optional, Any, Union
from enum import Enum


class CheckStatus(Enum):
    PENDING = "待处理"
    NORMAL = "正常"
    ABNORMAL = "异常"
    NEED_REVIEW = "待负责人复核"
    CONFIRMED = "数据分析师已确认"
    REJECTED = "数据分析师已驳回"
    SUPPLEMENTED = "已补录"
    RECALCULATED = "已重算"


class WarningType(Enum):
    PERCENT_DECIMAL_MIX = "百分数小数混合"
    DUPLICATE_IMPORT = "重复导入"
    DATA_MISMATCH = "数据不一致"
    PARAM_CONFLICT = "参数冲突"
    CALCULATION_ERROR = "计算错误"
    EXPORT_MISMATCH = "导出不一致"
    MISSING_DATA = "数据缺失"


class DataSource(Enum):
    SAMPLING_LIST = "抽样名单"
    PARAM_DEBUG_TABLE = "参数调试表"
    SUPPLEMENT = "补录材料"


@dataclass
class GridBoundaryData:
    grid_id: str
    boundary_value: Union[str, float]
    raw_value: str
    is_percent: Optional[bool] = None
    numeric_value: Optional[float] = None
    source: DataSource = DataSource.SAMPLING_LIST
    row_index: int = 0


@dataclass
class SamplingRecord:
    grid_id: str
    sample_time: str
    boundary_threshold: str
    raw_boundary: str
    check_point: str
    operator: str


@dataclass
class ParamDebugRecord:
    grid_id: str
    param_name: str
    param_value: str
    debug_time: str
    analyst: str
    remark: str = ""


@dataclass
class CalculationDetail:
    grid_id: str
    boundary_value: float
    is_percent: bool
    calculation_result: float
    check_pass: bool
    calculation_time: datetime
    source: str
    remark: str = ""
    original_sampling_value: str = ""
    original_param_value: str = ""
    conflict_resolved: bool = False
    analyst_decision: str = ""
    manager_review_needed: bool = False


@dataclass
class HistoryRecord:
    record_id: str
    operation_type: str
    operator: str
    operation_time: datetime
    detail: str
    data_before: Optional[Dict[str, Any]] = None
    data_after: Optional[Dict[str, Any]] = None


@dataclass
class ConflictEvidence:
    grid_id: str
    field_name: str
    sampling_value: str
    param_value: str
    sampling_source: str = "抽样名单"
    param_source: str = "参数调试表"
    description: str = ""
    severity: str = "high"
    analyst_decision: Optional[str] = None
    analyst_name: str = ""
    need_manager_review: bool = False


@dataclass
class WarningItem:
    warning_type: WarningType
    grid_id: str
    field_name: str
    current_value: str
    expected_value: Optional[str] = None
    description: str = ""
    suggestion: str = ""
    need_manager_review: bool = False
    source_table: str = ""
    duplicate_reason: str = ""
    batch_info: str = ""


@dataclass
class SelfCheckResult:
    check_name: str
    passed: bool
    warnings: List[WarningItem] = field(default_factory=list)
    details: str = ""


@dataclass
class CheckResult:
    status: CheckStatus
    calculation_details: List[CalculationDetail] = field(default_factory=list)
    conflicts: List[ConflictEvidence] = field(default_factory=list)
    warnings: List[WarningItem] = field(default_factory=list)
    self_check_results: List[SelfCheckResult] = field(default_factory=list)
    history: List[HistoryRecord] = field(default_factory=list)
    message: str = ""


class MaterialType(Enum):
    NORMAL = "正常材料"
    WRONG_CALIBER = "错口径材料"
    SUPPLEMENT = "补录材料"

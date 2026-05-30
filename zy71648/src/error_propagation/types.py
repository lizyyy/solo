"""核心数据类型定义"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple, Any
from enum import Enum
import numpy as np


class Severity(str, Enum):
    """问题严重程度"""
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class IssueType(str, Enum):
    """问题类型"""
    EMPTY_COLUMN = "empty_column"
    EMPTY_ROW = "empty_row"
    DUPLICATE_ROW = "duplicate_row"
    TYPO = "typo"
    UNIT_MISMATCH = "unit_mismatch"
    INVALID_UNIT = "invalid_unit"
    CORRELATED_VARIABLES = "correlated_variables"
    SIGNIFICANT_FIGURES = "significant_figures"
    MISSING_UNCERTAINTY = "missing_uncertainty"
    INVALID_FORMULA = "invalid_formula"
    BOUNDARY_VIOLATION = "boundary_violation"


@dataclass
class Issue:
    """数据或计算中发现的问题"""
    issue_type: IssueType
    severity: Severity
    message: str
    location: Optional[str] = None
    details: Dict[str, Any] = field(default_factory=dict)
    row_index: Optional[int] = None
    column_name: Optional[str] = None

    def __str__(self) -> str:
        loc = f" [{self.location}]" if self.location else ""
        return f"[{self.severity.value.upper()}] {self.issue_type.value}{loc}: {self.message}"


@dataclass
class Measurement:
    """单个测量值"""
    name: str
    value: float
    uncertainty: float
    unit: str
    description: Optional[str] = None
    significant_figures: Optional[int] = None
    raw_value: Optional[str] = None
    group: Optional[str] = None

    @property
    def relative_uncertainty(self) -> float:
        """相对不确定度"""
        if abs(self.value) < 1e-12:
            return float('inf')
        return abs(self.uncertainty / self.value)

    def __repr__(self) -> str:
        return f"{self.name} = {self.value} ± {self.uncertainty} {self.unit}"


@dataclass
class Formula:
    """计算公式"""
    expression: str
    target_variable: str
    description: Optional[str] = None
    raw_expression: Optional[str] = None


@dataclass
class PropagationStep:
    """误差传播的单个步骤"""
    step_number: int
    description: str
    formula_latex: str
    formula_text: str
    variables: List[str]
    partial_derivatives: Dict[str, str]
    intermediate_values: Dict[str, float]
    uncertainty_contribution: Dict[str, float]
    notes: List[str] = field(default_factory=list)


@dataclass
class PropagationResult:
    """误差传播计算结果"""
    target_name: str
    target_value: float
    target_uncertainty: float
    target_unit: str
    relative_uncertainty: float
    steps: List[PropagationStep]
    combined_formula_latex: str
    uncertainty_contributions: Dict[str, float]
    dominant_source: str
    boundary_checks: List[str]
    interpretation: str


@dataclass
class ExperimentGroup:
    """实验组数据"""
    name: str
    measurements: Dict[str, Measurement]
    formulas: List[Formula]
    results: Dict[str, PropagationResult] = field(default_factory=dict)
    issues: List[Issue] = field(default_factory=list)
    notes: Optional[str] = None
    teacher_comments: Optional[str] = None


@dataclass
class ProcessedData:
    """处理后的完整数据"""
    groups: Dict[str, ExperimentGroup]
    all_issues: List[Issue]
    cleaning_log: List[str]
    processing_order: List[str]
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class CorrectionRecord:
    """人工修正记录"""
    field: str
    old_value: Any
    new_value: Any
    reason: str
    corrected_by: str
    timestamp: float


@dataclass
class HistoryEntry:
    """历史记录条目"""
    id: int
    file_name: str
    processed_at: float
    processed_by: str
    original_data_hash: str
    corrections: List[CorrectionRecord]
    issues_found: int
    issues_resolved: int
    summary: str
    report_path: Optional[str] = None

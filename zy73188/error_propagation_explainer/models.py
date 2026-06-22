"""数据模型定义"""

from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any
from enum import Enum
import json


class CaseStatus(Enum):
    """题目处理状态"""
    SUCCESS = "success"
    SUSPENDED = "suspended"
    FAILED = "failed"
    MERGED = "merged"
    SKIPPED = "skipped"


class EvidenceStatus(Enum):
    """证据状态"""
    CONFIRMED = "confirmed"
    PENDING = "pending"
    MISSING = "missing"


class AnomalyType(Enum):
    """异常类型"""
    EMPTY_INPUT = "empty_input"
    PARSE_ERROR = "parse_error"
    DUPLICATE_IDENTICAL = "duplicate_identical"
    DUPLICATE_CONFLICT = "duplicate_conflict"
    BOUNDARY_SAMPLE = "boundary_sample"
    MISSING_FIELD = "missing_field"
    UNKNOWN_FORMULA = "unknown_formula"
    CALCULATION_ERROR = "calculation_error"


class SeverityLevel(Enum):
    """严重程度"""
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


@dataclass
class Variable:
    """测量变量"""
    name: str
    symbol: str
    value: float
    uncertainty: float
    unit: str
    evidence_source: Optional[str] = None
    evidence_status: EvidenceStatus = EvidenceStatus.CONFIRMED
    evidence_notes: Optional[str] = None
    is_boundary: bool = False
    relative_uncertainty: float = 0.0

    def __post_init__(self):
        if isinstance(self.evidence_status, str):
            self.evidence_status = EvidenceStatus(self.evidence_status)
        if abs(self.value) < 1e-12:
            self.relative_uncertainty = float('inf') if self.uncertainty > 0 else 0.0
        else:
            self.relative_uncertainty = abs(self.uncertainty / self.value)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "symbol": self.symbol,
            "value": self.value,
            "uncertainty": self.uncertainty,
            "unit": self.unit,
            "evidence_source": self.evidence_source,
            "evidence_status": self.evidence_status.value,
            "evidence_notes": self.evidence_notes,
            "is_boundary": self.is_boundary,
            "relative_uncertainty_pct": round(self.relative_uncertainty * 100, 2)
                if self.relative_uncertainty != float('inf') else "inf",
        }


@dataclass
class AnomalyRecord:
    """异常记录"""
    anomaly_type: AnomalyType
    severity: SeverityLevel
    message: str
    case_id: Optional[str] = None
    file_name: Optional[str] = None
    details: Dict[str, Any] = field(default_factory=dict)
    resolution_hint: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "anomaly_type": self.anomaly_type.value,
            "severity": self.severity.value,
            "message": self.message,
            "case_id": self.case_id,
            "file_name": self.file_name,
            "details": self.details,
            "resolution_hint": self.resolution_hint,
        }


@dataclass
class CalculationResult:
    """计算结果"""
    result_value: float
    result_uncertainty: float
    result_unit: str
    relative_uncertainty_pct: float
    partial_derivatives: Dict[str, float]
    uncertainty_contributions: Dict[str, float]
    dominant_contribution: Optional[str]
    calc_trace: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "result_value": round(self.result_value, 6),
            "result_uncertainty": round(self.result_uncertainty, 6),
            "result_unit": self.result_unit,
            "relative_uncertainty_pct": round(self.relative_uncertainty_pct, 2),
            "partial_derivatives": {k: round(v, 6) for k, v in self.partial_derivatives.items()},
            "uncertainty_contributions_pct": {k: round(v, 2) for k, v in self.uncertainty_contributions.items()},
            "dominant_contribution": self.dominant_contribution,
            "calc_trace": self.calc_trace,
        }


@dataclass
class CaseRecord:
    """题目记录"""
    case_id: str
    title: str
    formula_name: str
    formula_name_resolved: Optional[str] = None
    description: str = ""
    variables: List[Variable] = field(default_factory=list)
    file_name: str = ""
    file_path: str = ""
    raw_formula_name: str = ""

    status: CaseStatus = CaseStatus.SUCCESS
    is_duplicate: bool = False
    duplicate_group_id: Optional[str] = None
    merged_into: Optional[str] = None
    is_boundary: bool = False
    error_message: Optional[str] = None
    result: Optional[CalculationResult] = None
    anomalies: List[AnomalyRecord] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "case_id": self.case_id,
            "title": self.title,
            "formula_name": self.formula_name,
            "formula_name_resolved": self.formula_name_resolved,
            "description": self.description,
            "file_name": self.file_name,
            "variables": [v.to_dict() for v in self.variables],
            "status": self.status.value,
            "is_duplicate": self.is_duplicate,
            "duplicate_group_id": self.duplicate_group_id,
            "merged_into": self.merged_into,
            "is_boundary": self.is_boundary,
            "error_message": self.error_message,
            "result": self.result.to_dict() if self.result else None,
            "anomalies": [a.to_dict() for a in self.anomalies],
            "warnings": self.warnings,
        }


@dataclass
class ProcessingSummary:
    """处理汇总"""
    total_files: int = 0
    total_cases: int = 0
    success_count: int = 0
    suspended_count: int = 0
    failed_count: int = 0
    merged_count: int = 0
    boundary_count: int = 0
    duplicate_groups: int = 0
    confirmed_evidence_count: int = 0
    pending_evidence_count: int = 0
    missing_evidence_count: int = 0
    total_anomalies: int = 0
    key_findings: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "total_files": self.total_files,
            "total_cases": self.total_cases,
            "success_count": self.success_count,
            "suspended_count": self.suspended_count,
            "failed_count": self.failed_count,
            "merged_count": self.merged_count,
            "boundary_count": self.boundary_count,
            "duplicate_groups": self.duplicate_groups,
            "confirmed_evidence_count": self.confirmed_evidence_count,
            "pending_evidence_count": self.pending_evidence_count,
            "missing_evidence_count": self.missing_evidence_count,
            "total_anomalies": self.total_anomalies,
            "key_findings": self.key_findings,
        }

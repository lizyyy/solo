"""数据模型定义"""

from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple, Any
from enum import Enum
import uuid


class EvidenceStatus(Enum):
    """证据状态"""
    CONFIRMED = "confirmed"
    PENDING = "pending"
    MISSING = "missing"


class VariableType(Enum):
    """变量类型"""
    DIRECT_MEASUREMENT = "direct_measurement"
    DERIVED_QUANTITY = "derived_quantity"
    CONSTANT = "constant"


@dataclass
class MeasurementVariable:
    """测量变量"""
    name: str
    symbol: str
    value: float
    uncertainty: float
    unit: str
    variable_type: VariableType = VariableType.DIRECT_MEASUREMENT
    evidence_status: EvidenceStatus = EvidenceStatus.CONFIRMED
    evidence_source: Optional[str] = None
    evidence_notes: Optional[str] = None
    description: Optional[str] = None
    sample_id: str = field(default_factory=lambda: str(uuid.uuid4())[:8])
    is_boundary: bool = False
    is_duplicate: bool = False
    duplicate_of: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    @property
    def relative_uncertainty(self) -> float:
        if abs(self.value) < 1e-10:
            return float('inf')
        return abs(self.uncertainty / self.value)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "symbol": self.symbol,
            "value": self.value,
            "uncertainty": self.uncertainty,
            "unit": self.unit,
            "variable_type": self.variable_type.value,
            "evidence_status": self.evidence_status.value,
            "evidence_source": self.evidence_source,
            "evidence_notes": self.evidence_notes,
            "description": self.description,
            "sample_id": self.sample_id,
            "is_boundary": self.is_boundary,
            "is_duplicate": self.is_duplicate,
            "duplicate_of": self.duplicate_of,
            "relative_uncertainty": self.relative_uncertainty,
            "metadata": self.metadata,
        }


@dataclass
class PropagationFormula:
    """传播公式"""
    name: str
    expression: str
    description: str
    variables: List[str]
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "expression": self.expression,
            "description": self.description,
            "variables": self.variables,
        }


@dataclass
class PropagationResult:
    """传播计算结果"""
    formula: PropagationFormula
    variables: List[MeasurementVariable]
    result_value: float
    result_uncertainty: float
    result_unit: str
    partial_derivatives: Dict[str, float]
    uncertainty_contributions: Dict[str, float]
    calculation_trace: List[str] = field(default_factory=list)
    suspended: bool = False
    suspension_reason: Optional[str] = None
    
    @property
    def relative_uncertainty(self) -> float:
        if abs(self.result_value) < 1e-10:
            return float('inf')
        return abs(self.result_uncertainty / self.result_value)
    
    @property
    def dominant_contribution(self) -> Optional[str]:
        if not self.uncertainty_contributions:
            return None
        return max(self.uncertainty_contributions.items(), key=lambda x: x[1])[0]
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "formula": self.formula.to_dict(),
            "variables": [v.to_dict() for v in self.variables],
            "result_value": self.result_value,
            "result_uncertainty": self.result_uncertainty,
            "result_unit": self.result_unit,
            "partial_derivatives": self.partial_derivatives,
            "uncertainty_contributions": self.uncertainty_contributions,
            "relative_uncertainty": self.relative_uncertainty,
            "dominant_contribution": self.dominant_contribution,
            "suspended": self.suspended,
            "suspension_reason": self.suspension_reason,
            "calculation_trace": self.calculation_trace,
        }


@dataclass
class AnalysisSummary:
    """分析摘要（终端显示用，与异常队列分离）"""
    total_samples: int
    valid_samples: int
    boundary_samples: int
    duplicate_samples: int
    suspended_samples: int
    formulas_analyzed: List[str]
    key_findings: List[str]
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "total_samples": self.total_samples,
            "valid_samples": self.valid_samples,
            "boundary_samples": self.boundary_samples,
            "duplicate_samples": self.duplicate_samples,
            "suspended_samples": self.suspended_samples,
            "formulas_analyzed": self.formulas_analyzed,
            "key_findings": self.key_findings,
        }


@dataclass
class ReviewerReport:
    """复核人报告"""
    confirmed_evidence: List[Dict[str, Any]]
    pending_evidence: List[Dict[str, Any]]
    missing_evidence: List[Dict[str, Any]]
    recommendations: List[str]
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "confirmed_evidence": self.confirmed_evidence,
            "pending_evidence": self.pending_evidence,
            "missing_evidence": self.missing_evidence,
            "recommendations": self.recommendations,
        }

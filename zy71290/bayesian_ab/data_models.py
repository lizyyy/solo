"""数据模型定义 - 所有核心数据结构"""

from dataclasses import dataclass, field, asdict
from typing import Dict, List, Optional, Tuple, Any
from enum import Enum
from datetime import datetime


class FieldStatus(str, Enum):
    """字段状态"""
    PRESENT = "present"
    MISSING = "missing"
    INVALID = "invalid"


class DataQuality(str, Enum):
    """数据质量等级"""
    CLEAN = "clean"
    BORDERLINE = "borderline"
    DIRTY = "dirty"


class RiskLevel(str, Enum):
    """风险等级"""
    NONE = "none"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class StoppingReason(str, Enum):
    """停测原因"""
    NOT_STOPPED = "not_stopped"
    EARLY_STOP = "early_stop"
    SAMPLE_SIZE_REACHED = "sample_size_reached"
    OBSERVATION_WINDOW_END = "observation_window_end"
    MANUAL_STOP = "manual_stop"


class VariantType(str, Enum):
    """变体类型"""
    CONTROL = "control"
    TREATMENT = "treatment"


@dataclass
class VariantData:
    """变体数据（实验组/对照组）"""
    name: str
    variant_type: VariantType
    sample_size: Optional[int] = None
    conversions: Optional[int] = None
    metric_name: Optional[str] = None
    metric_value: Optional[float] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "variant_type": self.variant_type.value,
            "sample_size": self.sample_size,
            "conversions": self.conversions,
            "metric_name": self.metric_name,
            "metric_value": self.metric_value,
        }


@dataclass
class PriorParams:
    """先验参数 - Beta分布参数"""
    alpha: Optional[float] = None
    beta: Optional[float] = None
    description: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "alpha": self.alpha,
            "beta": self.beta,
            "description": self.description,
        }


@dataclass
class ExperimentInput:
    """试验输入 - 完整的试验参数"""
    experiment_id: Optional[str] = None
    experiment_name: Optional[str] = None
    control: Optional[VariantData] = None
    treatment: Optional[VariantData] = None
    prior: Optional[PriorParams] = None
    observation_window_days: Optional[int] = None
    planned_sample_size: Optional[int] = None
    current_day: Optional[int] = None
    stopping_threshold: Optional[float] = None
    metrics: Optional[List[VariantData]] = None
    notes: Optional[str] = None
    timestamp: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "experiment_id": self.experiment_id,
            "experiment_name": self.experiment_name,
            "control": self.control.to_dict() if self.control else None,
            "treatment": self.treatment.to_dict() if self.treatment else None,
            "prior": self.prior.to_dict() if self.prior else None,
            "observation_window_days": self.observation_window_days,
            "planned_sample_size": self.planned_sample_size,
            "current_day": self.current_day,
            "stopping_threshold": self.stopping_threshold,
            "metrics": [m.to_dict() for m in self.metrics] if self.metrics else None,
            "notes": self.notes,
            "timestamp": self.timestamp.isoformat(),
        }


@dataclass
class FieldValidation:
    """字段验证结果"""
    field_name: str
    status: FieldStatus
    message: Optional[str] = None
    provided_value: Optional[Any] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "field_name": self.field_name,
            "status": self.status.value,
            "message": self.message,
            "provided_value": self.provided_value,
        }


@dataclass
class ValidationResult:
    """输入验证结果"""
    is_valid: bool
    fields: List[FieldValidation]
    data_quality: DataQuality
    processing_order: List[str]
    missing_fields: List[str]
    invalid_fields: List[str]
    warnings: List[str]
    errors: List[str]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "is_valid": self.is_valid,
            "fields": [f.to_dict() for f in self.fields],
            "data_quality": self.data_quality.value,
            "processing_order": self.processing_order,
            "missing_fields": self.missing_fields,
            "invalid_fields": self.invalid_fields,
            "warnings": self.warnings,
            "errors": self.errors,
        }


@dataclass
class PosteriorStats:
    """后验统计量"""
    mean: float
    median: float
    std: float
    ci_lower: float
    ci_upper: float
    credible_level: float
    samples: Optional[List[float]] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "mean": self.mean,
            "median": self.median,
            "std": self.std,
            "ci_lower": self.ci_lower,
            "ci_upper": self.ci_upper,
            "credible_level": self.credible_level,
        }


@dataclass
class BayesianResult:
    """贝叶斯计算结果"""
    control_posterior: PosteriorStats
    treatment_posterior: PosteriorStats
    prior_strength: float
    effective_sample_size: float
    probability_treatment_better: float
    expected_lift: float
    lift_ci_lower: float
    lift_ci_upper: float
    computation_trace: Dict[str, Any]
    metric_results: Optional[Dict[str, "BayesianResult"]] = None

    def to_dict(self) -> Dict[str, Any]:
        result = {
            "control_posterior": self.control_posterior.to_dict(),
            "treatment_posterior": self.treatment_posterior.to_dict(),
            "prior_strength": self.prior_strength,
            "effective_sample_size": self.effective_sample_size,
            "probability_treatment_better": self.probability_treatment_better,
            "expected_lift": self.expected_lift,
            "lift_ci_lower": self.lift_ci_lower,
            "lift_ci_upper": self.lift_ci_upper,
            "computation_trace": self.computation_trace,
        }
        if self.metric_results:
            result["metric_results"] = {
                k: v.to_dict() for k, v in self.metric_results.items()
            }
        return result


@dataclass
class RiskFlag:
    """风险标记"""
    risk_type: str
    level: RiskLevel
    message: str
    evidence: Dict[str, Any]
    recommendation: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "risk_type": self.risk_type,
            "level": self.level.value,
            "message": self.message,
            "evidence": self.evidence,
            "recommendation": self.recommendation,
        }


@dataclass
class RiskAssessment:
    """风险评估结果"""
    has_early_stop: bool
    has_strong_prior: bool
    has_metric_conflict: bool
    overall_risk_level: RiskLevel
    flags: List[RiskFlag]
    stopping_recommendation: StoppingReason
    stopping_message: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "has_early_stop": self.has_early_stop,
            "has_strong_prior": self.has_strong_prior,
            "has_metric_conflict": self.has_metric_conflict,
            "overall_risk_level": self.overall_risk_level.value,
            "flags": [f.to_dict() for f in self.flags],
            "stopping_recommendation": self.stopping_recommendation.value,
            "stopping_message": self.stopping_message,
        }


@dataclass
class ExperimentReport:
    """完整试验报告"""
    experiment_id: str
    input_hash: str
    reproducibility_seed: int
    validation: ValidationResult
    bayesian_result: BayesianResult
    risk_assessment: RiskAssessment
    conclusions: List[str]
    recommendations: List[str]
    generated_at: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "experiment_id": self.experiment_id,
            "input_hash": self.input_hash,
            "reproducibility_seed": self.reproducibility_seed,
            "validation": self.validation.to_dict(),
            "bayesian_result": self.bayesian_result.to_dict(),
            "risk_assessment": self.risk_assessment.to_dict(),
            "conclusions": self.conclusions,
            "recommendations": self.recommendations,
            "generated_at": self.generated_at.isoformat(),
        }

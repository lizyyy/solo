"""贝叶斯A/B试验台 - 可复算的A/B测试分析工具"""

__version__ = "1.0.0"
__all__ = [
    "ExperimentInput",
    "ValidationResult",
    "BayesianResult",
    "RiskAssessment",
    "ExperimentReport",
    "InputValidator",
    "BayesianCalculator",
    "RiskDetector",
    "ReportGenerator",
    "ReproducibilityManager",
    "run_experiment",
]

from .data_models import (
    ExperimentInput,
    ValidationResult,
    BayesianResult,
    RiskAssessment,
    ExperimentReport,
)
from .input_validator import InputValidator
from .bayesian_core import BayesianCalculator
from .risk_detector import RiskDetector
from .report_generator import ReportGenerator
from .reproducibility import ReproducibilityManager
from .pipeline import run_experiment

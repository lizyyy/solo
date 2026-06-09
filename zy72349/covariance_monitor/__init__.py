"""协方差漂移监测工具 - 教研数据质量管控系统"""

from .monitor import CovarianceMonitor
from .types import (
    RecordStatus,
    DriftRecord,
    FormulaSource,
    ReviewField,
    Formula,
    ValueEntry,
    CalculationDetail,
    CalculationSnapshot,
    ConflictEvidence,
    ReviewResult,
    ValueChange,
    MonitorSession,
)
from .exceptions import (
    MonitorError,
    ConflictDetectedError,
    MixedFormatError,
    PendingReviewError,
    FormulaNotFoundError,
)
from .samples import get_sample, describe_samples, SAMPLE_NORMAL, SAMPLE_MIXED_FORMAT, SAMPLE_SUPPLEMENTARY

__version__ = "2.0.0"
__all__ = [
    "CovarianceMonitor",
    "RecordStatus",
    "DriftRecord",
    "FormulaSource",
    "ReviewField",
    "Formula",
    "ValueEntry",
    "CalculationDetail",
    "CalculationSnapshot",
    "ConflictEvidence",
    "ReviewResult",
    "ValueChange",
    "MonitorSession",
    "MonitorError",
    "ConflictDetectedError",
    "MixedFormatError",
    "PendingReviewError",
    "FormulaNotFoundError",
    "get_sample",
    "describe_samples",
    "SAMPLE_NORMAL",
    "SAMPLE_MIXED_FORMAT",
    "SAMPLE_SUPPLEMENTARY",
]

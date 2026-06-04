"""协方差漂移监测工具 - 教研数据质量管控系统"""

from .monitor import CovarianceMonitor
from .types import (
    RecordStatus,
    DriftRecord,
    FormulaSource,
    ConflictEvidence,
    ReviewResult,
    MonitorSession,
)
from .exceptions import (
    MonitorError,
    ConflictDetectedError,
    MixedFormatError,
    PendingReviewError,
)
from .samples import get_sample, describe_samples, SAMPLE_NORMAL, SAMPLE_MIXED_FORMAT, SAMPLE_SUPPLEMENTARY

__version__ = "1.0.0"
__all__ = [
    "CovarianceMonitor",
    "RecordStatus",
    "DriftRecord",
    "FormulaSource",
    "ConflictEvidence",
    "ReviewResult",
    "MonitorSession",
    "MonitorError",
    "ConflictDetectedError",
    "MixedFormatError",
    "PendingReviewError",
    "get_sample",
    "describe_samples",
    "SAMPLE_NORMAL",
    "SAMPLE_MIXED_FORMAT",
    "SAMPLE_SUPPLEMENTARY",
]

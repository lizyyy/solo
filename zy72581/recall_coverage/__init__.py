"""召回覆盖率缺口分析工具包"""

__version__ = "0.1.0"

from .api import RecallCoverageAPI
from .models import (
    EvalSlice, CoverageGapRecord, FeatureSnapshot,
    ThresholdReplayResult, RecordStatus, SliceSource
)
from .storage import DataStore
from .analyzer import CoverageAnalyzer
from .replay import ThresholdReplayEngine

__all__ = [
    "RecallCoverageAPI",
    "DataStore",
    "CoverageAnalyzer",
    "ThresholdReplayEngine",
    "EvalSlice",
    "CoverageGapRecord",
    "FeatureSnapshot",
    "ThresholdReplayResult",
    "RecordStatus",
    "SliceSource",
]

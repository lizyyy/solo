"""水质检测质控报告器"""

from .config import QCConfig, DEFAULT_CONFIG
from .data_loader import DataLoader, LoadResult
from .preprocessor import DataPreprocessor
from .qc_engine import QCEngine, QCResult, SampleFailure
from .reporter import ReportGenerator
from .exporter import Exporter

__version__ = "1.0.0"
__all__ = [
    "QCConfig",
    "DEFAULT_CONFIG",
    "DataLoader",
    "LoadResult",
    "DataPreprocessor",
    "QCEngine",
    "QCResult",
    "SampleFailure",
    "ReportGenerator",
    "Exporter",
]

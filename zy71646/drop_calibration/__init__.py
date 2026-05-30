"""
游戏掉落概率校准系统
==================

用于比较配置概率和真实掉落是否偏离，支持：
- 多版本数据导入，保留历史记录
- 数据清洗：去重、活动加成计算、概率归一化校验
- 概率检验：卡方检验、分组统计、置信区间
- 异常检测：标注异常原因，定位数据源
- 配置对比：配置概率 vs 实际掉落
- 可复现报告：保留计算参数，支持筛选导出
"""

__version__ = "1.0.0"
__author__ = "Game Operations Analytics Team"

from .exceptions import (
    DropCalibrationError,
    DataImportError,
    DataValidationError,
    ProbabilityCalculationError,
    ReportExportError,
    BatchProcessingError,
    ErrorLocation,
    create_error_location,
)
from .models import (
    DropConfig,
    PlayerLog,
    ItemPool,
    ActivityPeriod,
    ComplaintRecord,
    CalibrationParams,
    DataSource,
    DataSourceType,
)
from .data_import import DataImporter, ImportResult
from .data_cleaning import DataCleaner, CleaningResult
from .probability_test import ProbabilityTester, TestResult
from .anomaly_detection import AnomalyDetector, AnomalyReport, AnomalyItem
from .config_comparison import ConfigComparator, ComparisonResult
from .report_export import ReportExporter, ExportConfig
from .batch_processor import (
    BatchProcessor,
    BatchFile,
    BatchResult,
    scan_directory,
)

__all__ = [
    "DropCalibrationError",
    "DataImportError",
    "DataValidationError",
    "ProbabilityCalculationError",
    "ReportExportError",
    "BatchProcessingError",
    "ErrorLocation",
    "create_error_location",
    "DropConfig",
    "PlayerLog",
    "ItemPool",
    "ActivityPeriod",
    "ComplaintRecord",
    "CalibrationParams",
    "DataSource",
    "DataSourceType",
    "DataImporter",
    "ImportResult",
    "DataCleaner",
    "CleaningResult",
    "ProbabilityTester",
    "TestResult",
    "AnomalyDetector",
    "AnomalyReport",
    "AnomalyItem",
    "ConfigComparator",
    "ComparisonResult",
    "ReportExporter",
    "ExportConfig",
    "BatchProcessor",
    "BatchFile",
    "BatchResult",
    "scan_directory",
]

"""弹簧振子拟合数据处理系统。

面向一线实验同事的物理实验数据处理工具，支持：
- 多源数据导入（CSV/Excel）
- 数据清洗与去重
- 零点漂移检测
- 弹簧振子周期-质量拟合
- 采样缺口溯源
- 人性化错误提示
- 实验批改表生成
"""

from .models import (
    DataStatus,
    RecordSource,
    GapType,
    ExperimentRecord,
    CalibrationRecord,
    FitResult,
    DataGap,
    ProcessingSummary,
)
from .errors import SpringOscillatorError, DataImportError, DataValidationError

__version__ = "1.0.0"
__all__ = [
    "DataStatus",
    "RecordSource",
    "GapType",
    "ExperimentRecord",
    "CalibrationRecord",
    "FitResult",
    "DataGap",
    "ProcessingSummary",
    "SpringOscillatorError",
    "DataImportError",
    "DataValidationError",
]

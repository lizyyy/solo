"""分位数薪酬校准系统"""

__version__ = "1.0.0"

from .main import (
    QuantileCalibrationSystem,
    BoundaryType,
    ProcessingStatus,
    Database,
    BoundaryRuleEngine,
    RatingWeightImporter,
    WorkflowManager
)

__all__ = [
    "QuantileCalibrationSystem",
    "BoundaryType",
    "ProcessingStatus",
    "Database",
    "BoundaryRuleEngine",
    "RatingWeightImporter",
    "WorkflowManager"
]

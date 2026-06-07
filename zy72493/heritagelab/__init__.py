"""文化遗产视廊控制系统"""
from .core import HeritageCorridorService
from .report import ReportGenerator
from .models import (
    HeritageCorridorControl,
    InspectionRecord,
    ConstructionNotice,
    ResidentOpinion,
    ConflictItem,
    OpinionStatus,
    ConflictLevel,
    NextAction
)

__version__ = "1.0.0"

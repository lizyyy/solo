"""报告生成模块"""

from .generator import ReportGenerator, ReportFormat
from .interpreter import ResultInterpreter, Explanation

__all__ = [
    "ReportGenerator",
    "ReportFormat",
    "ResultInterpreter",
    "Explanation",
]

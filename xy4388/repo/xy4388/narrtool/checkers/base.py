"""基础检查器类"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, List, Optional

from narrtool.database.models import CheckType, Severity


def time_overlap(
    start1: float, end1: float, 
    start2: float, end2: float,
    allow_touch: bool = False
) -> bool:
    """
    检查两个时间段是否重叠
    allow_touch: 是否允许边界接触（如 end1 == start2）
    """
    if allow_touch:
        return not (end1 < start2 or end2 < start1)
    else:
        return not (end1 <= start2 or end2 <= start1)


def time_overlap_datetime(
    start1: datetime, end1: datetime,
    start2: datetime, end2: datetime,
    allow_touch: bool = False
) -> bool:
    """
    检查两个 datetime 时间段是否重叠
    """
    if allow_touch:
        return not (end1 < start2 or end2 < start1)
    else:
        return not (end1 <= start2 or end2 <= start1)


@dataclass
class CheckResult:
    """检查结果数据类"""
    check_type: CheckType
    severity: Severity = Severity.MEDIUM
    description: str = ""
    related_ids: List[int] = field(default_factory=list)
    time_start: Optional[float] = None
    time_end: Optional[float] = None


class BaseChecker(ABC):
    """检查器基类"""
    
    @abstractmethod
    def check(self, screening_id: int, session) -> List[CheckResult]:
        """
        执行检查
        必须在子类中实现
        """
        pass

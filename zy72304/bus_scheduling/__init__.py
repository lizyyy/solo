"""
整数规划班车排班系统 (Integer Programming Bus Scheduling System)

核心功能：
- 处理抽样名单中百分数和小数混合的情况
- 提供边界规则校验、修改、回滚机制
- 追踪历史变更
- 支持3D/图表展示的复核跳转
"""

from .models import (
    SamplingRecord,
    SchedulingResult,
    CalculationDetail,
    ChangeHistory,
    MixedNumberIssue,
)
from .scheduler import BusScheduler
from .validator import BoundaryValidator
from .importer import SamplingImporter
from .workflow import SchedulingWorkflow
from .exceptions import SchedulingError, format_error

__version__ = "1.0.0"

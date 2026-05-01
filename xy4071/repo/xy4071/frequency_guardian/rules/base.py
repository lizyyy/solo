"""规则引擎基础类"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Generic, TypeVar

from ..models.config import ProjectConfig
from ..models.frequency import FrequencyPlan
from ..models.log import ContactLog
from ..models.radio import RadioInventory
from ..models.schedule import DutySchedule
from ..models.violation import Violation, ViolationSeverity, ViolationType


class RuleCategory(str, Enum):
    """规则分类"""

    DATA_VALIDATION = "data_validation"
    SCHEDULE_CONFLICT = "schedule_conflict"
    FREQUENCY_CONFLICT = "frequency_conflict"
    POWER_LIMIT = "power_limit"
    REPEATER_CHECK = "repeater_check"
    CALL_SIGN = "call_sign"


@dataclass
class RuleContext:
    """规则执行上下文"""

    project_config: Optional[ProjectConfig] = None
    radio_inventory: Optional[RadioInventory] = None
    frequency_plan: Optional[FrequencyPlan] = None
    duty_schedule: Optional[DutySchedule] = None
    contact_log: Optional[ContactLog] = None

    additional_data: Dict[str, Any] = field(default_factory=dict)

    execution_time: datetime = field(default_factory=datetime.now)

    def get_all_call_signs(self) -> List[str]:
        """获取所有已知的呼号"""
        call_signs: set = set()

        if self.radio_inventory:
            for device in self.radio_inventory.devices:
                call_signs.add(device.call_sign)

        if self.frequency_plan:
            for assignment in self.frequency_plan.assignments:
                call_signs.add(assignment.call_sign)

        if self.duty_schedule:
            for shift in self.duty_schedule.shifts:
                call_signs.add(shift.call_sign)

        if self.contact_log:
            for entry in self.contact_log.entries:
                call_signs.add(entry.call_sign_own)
                call_signs.add(entry.call_sign_other)

        return sorted(list(call_signs))

    def get_channel_by_id(self, channel_id: str) -> Optional[Any]:
        """根据频道ID获取频道"""
        if self.frequency_plan:
            return self.frequency_plan.get_channel_by_id(channel_id)
        return None

    def get_device_by_call_sign(self, call_sign: str) -> Optional[Any]:
        """根据呼号获取设备"""
        if self.radio_inventory:
            return self.radio_inventory.get_device_by_call_sign(call_sign)
        return None


@dataclass
class RuleResult:
    """规则执行结果"""

    rule_name: str
    rule_code: str
    rule_category: RuleCategory

    passed: bool = True
    violations: List[Violation] = field(default_factory=list)
    warnings: List[Violation] = field(default_factory=list)

    execution_start: Optional[datetime] = None
    execution_end: Optional[datetime] = None
    execution_duration_ms: float = 0.0

    metadata: Dict[str, Any] = field(default_factory=dict)

    def add_violation(self, violation: Violation) -> None:
        """添加违规"""
        self.violations.append(violation)
        self.passed = False

    def add_warning(self, warning: Violation) -> None:
        """添加警告"""
        self.warnings.append(warning)

    def has_violations(self) -> bool:
        """是否有违规"""
        return len(self.violations) > 0

    def has_warnings(self) -> bool:
        """是否有警告"""
        return len(self.warnings) > 0

    def get_violation_count(self) -> int:
        """获取违规数量"""
        return len(self.violations)

    def get_warning_count(self) -> int:
        """获取警告数量"""
        return len(self.warnings)


T = TypeVar("T")


class BaseRule(ABC, Generic[T]):
    """规则基类"""

    def __init__(
        self,
        name: str,
        code: str,
        category: RuleCategory,
        description: str = "",
        severity: ViolationSeverity = ViolationSeverity.MEDIUM,
        enabled: bool = True,
    ):
        """
        初始化规则

        Args:
            name: 规则名称
            code: 规则代码
            category: 规则分类
            description: 规则描述
            severity: 默认严重程度
            enabled: 是否启用
        """
        self.name = name
        self.code = code
        self.category = category
        self.description = description
        self.default_severity = severity
        self.enabled = enabled

    @abstractmethod
    def execute(self, context: RuleContext) -> RuleResult:
        """
        执行规则

        Args:
            context: 规则执行上下文

        Returns:
            规则执行结果
        """
        pass

    @abstractmethod
    def applies_to(self, context: RuleContext) -> bool:
        """
        检查规则是否适用于当前上下文

        Args:
            context: 规则执行上下文

        Returns:
            是否适用
        """
        pass

    def create_violation(
        self,
        violation_type: ViolationType,
        message: str,
        severity: Optional[ViolationSeverity] = None,
        **kwargs,
    ) -> Violation:
        """
        创建违规记录

        Args:
            violation_type: 违规类型
            message: 违规描述
            severity: 严重程度（可选，默认使用规则默认值）
            **kwargs: 其他字段

        Returns:
            违规记录
        """
        return Violation(
            violation_type=violation_type,
            severity=severity or self.default_severity,
            message=message,
            category=self.category.value,
            **kwargs,
        )

    def _start_execution(self, result: RuleResult) -> None:
        """开始执行计时"""
        result.execution_start = datetime.now()

    def _end_execution(self, result: RuleResult) -> None:
        """结束执行计时"""
        result.execution_end = datetime.now()
        if result.execution_start and result.execution_end:
            delta = result.execution_end - result.execution_start
            result.execution_duration_ms = delta.total_seconds() * 1000

    def create_result(self, passed: bool = True) -> RuleResult:
        """创建规则结果"""
        return RuleResult(
            rule_name=self.name,
            rule_code=self.code,
            rule_category=self.category,
            passed=passed,
        )

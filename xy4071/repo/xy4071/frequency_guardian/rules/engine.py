"""规则引擎"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional, Type

from ..models.config import ProjectConfig
from ..models.frequency import FrequencyPlan
from ..models.log import ContactLog
from ..models.radio import RadioInventory
from ..models.schedule import DutySchedule
from ..models.violation import Violation, ViolationSummary

from .base import BaseRule, RuleContext, RuleResult
from .call_sign_rule import CallSignFormatRule
from .channel_conflict_rule import ChannelConflictRule
from .frequency_rule import FrequencyBandRule
from .operator_conflict_rule import OperatorConflictRule
from .power_rule import PowerLimitRule
from .repeater_switch_rule import RepeaterSwitchRule
from .time_overlap_rule import TimeOverlapRule


@dataclass
class RuleExecutionResult:
    """规则执行结果汇总"""

    success: bool = True
    total_rules: int = 0
    rules_passed: int = 0
    rules_failed: int = 0
    rules_skipped: int = 0

    violations: List[Violation] = field(default_factory=list)
    warnings: List[Violation] = field(default_factory=list)

    rule_results: List[RuleResult] = field(default_factory=list)

    execution_start: datetime = field(default_factory=datetime.now)
    execution_end: Optional[datetime] = None
    total_execution_time_ms: float = 0.0

    summary: Optional[ViolationSummary] = None

    def add_rule_result(self, result: RuleResult) -> None:
        """添加规则执行结果"""
        self.rule_results.append(result)
        self.total_rules += 1

        if result.passed:
            self.rules_passed += 1
        else:
            self.rules_failed += 1
            self.success = False

        # 收集违规和警告
        self.violations.extend(result.violations)
        self.warnings.extend(result.warnings)

    def mark_skipped(self) -> None:
        """标记规则被跳过"""
        self.total_rules += 1
        self.rules_skipped += 1

    def build_summary(self) -> ViolationSummary:
        """构建违规摘要"""
        summary = ViolationSummary(
            total_count=len(self.violations),
            open_count=sum(1 for v in self.violations if v.status == "open"),
            reviewed_count=sum(1 for v in self.violations if v.status == "reviewed"),
            dismissed_count=sum(1 for v in self.violations if v.status == "dismissed"),
            resolved_count=sum(1 for v in self.violations if v.status == "resolved"),
        )

        # 按严重程度统计
        for violation in self.violations:
            severity = violation.severity
            if severity == "critical":
                summary.critical_count += 1
            elif severity == "high":
                summary.high_count += 1
            elif severity == "medium":
                summary.medium_count += 1
            elif severity == "low":
                summary.low_count += 1

        # 按类型统计
        for violation in self.violations:
            vtype = violation.violation_type
            summary.by_type[vtype] = summary.by_type.get(vtype, 0) + 1

        # 按呼号统计
        for violation in self.violations:
            if violation.call_sign:
                cs = violation.call_sign
                summary.by_call_sign[cs] = summary.by_call_sign.get(cs, 0) + 1

        # 按频道统计
        for violation in self.violations:
            if violation.channel_id:
                ch = violation.channel_id
                summary.by_channel[ch] = summary.by_channel.get(ch, 0) + 1

        # 按日期统计
        for violation in self.violations:
            if violation.date:
                dt = violation.date
                summary.by_date[dt] = summary.by_date.get(dt, 0) + 1

        self.summary = summary
        return summary

    def get_violations_by_severity(self, severity: str) -> List[Violation]:
        """按严重程度获取违规"""
        return [v for v in self.violations if v.severity == severity]

    def get_violations_by_type(self, violation_type: str) -> List[Violation]:
        """按类型获取违规"""
        return [v for v in self.violations if v.violation_type == violation_type]

    def get_violations_by_call_sign(self, call_sign: str) -> List[Violation]:
        """按呼号获取违规"""
        return [v for v in self.violations if v.call_sign and v.call_sign.upper() == call_sign.upper()]


class RuleEngine:
    """规则引擎"""

    def __init__(
        self,
        project_config: Optional[ProjectConfig] = None,
        radio_inventory: Optional[RadioInventory] = None,
        frequency_plan: Optional[FrequencyPlan] = None,
        duty_schedule: Optional[DutySchedule] = None,
        contact_log: Optional[ContactLog] = None,
    ):
        """
        初始化规则引擎

        Args:
            project_config: 项目配置
            radio_inventory: 电台设备清单
            frequency_plan: 频率计划
            duty_schedule: 值守排班
            contact_log: 通联日志
        """
        self.context = RuleContext(
            project_config=project_config,
            radio_inventory=radio_inventory,
            frequency_plan=frequency_plan,
            duty_schedule=duty_schedule,
            contact_log=contact_log,
        )

        # 默认规则列表
        self._default_rules: List[Type[BaseRule]] = [
            CallSignFormatRule,
            PowerLimitRule,
            FrequencyBandRule,
            ChannelConflictRule,
            OperatorConflictRule,
            TimeOverlapRule,
            RepeaterSwitchRule,
        ]

        self._custom_rules: List[BaseRule] = []

    def add_rule(self, rule: BaseRule) -> None:
        """添加自定义规则"""
        self._custom_rules.append(rule)

    def execute(
        self,
        rules: Optional[List[Type[BaseRule]]] = None,
        include_default: bool = True,
    ) -> RuleExecutionResult:
        """
        执行规则检查

        Args:
            rules: 要执行的规则列表（类型）
            include_default: 是否包含默认规则

        Returns:
            规则执行结果
        """
        result = RuleExecutionResult()
        result.execution_start = datetime.now()

        # 确定要执行的规则
        rules_to_execute: List[BaseRule] = []

        # 添加默认规则实例
        if include_default:
            for rule_class in self._default_rules:
                rules_to_execute.append(rule_class())

        # 添加指定的规则实例
        if rules:
            for rule_class in rules:
                # 检查是否已存在
                exists = any(isinstance(r, rule_class) for r in rules_to_execute)
                if not exists:
                    rules_to_execute.append(rule_class())

        # 添加自定义规则
        rules_to_execute.extend(self._custom_rules)

        # 执行每个规则
        for rule in rules_to_execute:
            if not rule.enabled:
                continue

            # 检查规则是否适用于当前上下文
            if not rule.applies_to(self.context):
                result.mark_skipped()
                continue

            # 执行规则
            rule_result = rule.execute(self.context)
            result.add_rule_result(rule_result)

        # 结束计时
        result.execution_end = datetime.now()
        if result.execution_start and result.execution_end:
            delta = result.execution_end - result.execution_start
            result.total_execution_time_ms = delta.total_seconds() * 1000

        # 构建摘要
        result.build_summary()

        return result

    def execute_single(self, rule_class: Type[BaseRule]) -> Optional[RuleResult]:
        """
        执行单个规则

        Args:
            rule_class: 规则类

        Returns:
            规则执行结果，如果不适用则返回 None
        """
        rule = rule_class()

        if not rule.enabled:
            return None

        if not rule.applies_to(self.context):
            return None

        return rule.execute(self.context)

    def get_available_rules(self) -> Dict[str, Dict[str, Any]]:
        """
        获取所有可用的规则信息

        Returns:
            规则信息字典
        """
        rules_info: Dict[str, Dict[str, Any]] = {}

        for rule_class in self._default_rules:
            # 实例化一个临时规则对象来获取信息
            rule = rule_class()
            rules_info[rule.code] = {
                "name": rule.name,
                "code": rule.code,
                "category": rule.category.value if hasattr(rule.category, "value") else rule.category,
                "description": rule.description,
                "default_severity": rule.default_severity.value if hasattr(rule.default_severity, "value") else rule.default_severity,
                "enabled": rule.enabled,
            }

        return rules_info

    def update_context(
        self,
        project_config: Optional[ProjectConfig] = None,
        radio_inventory: Optional[RadioInventory] = None,
        frequency_plan: Optional[FrequencyPlan] = None,
        duty_schedule: Optional[DutySchedule] = None,
        contact_log: Optional[ContactLog] = None,
    ) -> None:
        """
        更新规则上下文

        Args:
            project_config: 项目配置
            radio_inventory: 电台设备清单
            frequency_plan: 频率计划
            duty_schedule: 值守排班
            contact_log: 通联日志
        """
        if project_config is not None:
            self.context.project_config = project_config
        if radio_inventory is not None:
            self.context.radio_inventory = radio_inventory
        if frequency_plan is not None:
            self.context.frequency_plan = frequency_plan
        if duty_schedule is not None:
            self.context.duty_schedule = duty_schedule
        if contact_log is not None:
            self.context.contact_log = contact_log

"""功率限制规则"""

from typing import Any, Dict, List, Optional

from ..models.violation import ViolationEvidence, ViolationSeverity, ViolationType
from .base import BaseRule, RuleCategory, RuleContext, RuleResult


class PowerLimitRule(BaseRule[Any]):
    """功率限制规则"""

    def __init__(self, **kwargs):
        super().__init__(
            name="功率限制检查",
            code="RULE_POWER_LIMIT",
            category=RuleCategory.POWER_LIMIT,
            description="检查发射功率是否超过限制",
            severity=ViolationSeverity.CRITICAL,
            **kwargs,
        )

    def applies_to(self, context: RuleContext) -> bool:
        """检查是否适用"""
        # 只要有通联日志就适用
        return context.contact_log is not None or context.radio_inventory is not None

    def execute(self, context: RuleContext) -> RuleResult:
        """执行规则"""
        result = self.create_result()
        self._start_execution(result)

        # 获取最大功率限制
        max_power = self._get_max_power_limit(context)

        # 检查通联日志中的功率
        if context.contact_log:
            for entry in context.contact_log.entries:
                if entry.power_watts is not None:
                    if entry.power_watts > max_power:
                        evidence = ViolationEvidence(
                            field_name="power_watts",
                            expected_value=f"不超过 {max_power} 瓦",
                            actual_value=entry.power_watts,
                            context=f"通联记录功率超限",
                        )

                        violation = self.create_violation(
                            violation_type=ViolationType.POWER_EXCEEDED,
                            message=f"发射功率超限: {entry.power_watts}W > {max_power}W (呼号: {entry.call_sign_own})",
                            severity=ViolationSeverity.CRITICAL,
                            call_sign=entry.call_sign_own,
                            date=entry.date,
                            time_start=entry.time_start,
                            evidence=evidence,
                        )
                        result.add_violation(violation)

        # 检查设备清单中的最大额定功率是否合理
        if context.radio_inventory:
            for device in context.radio_inventory.devices:
                if device.max_power_watts > max_power * 2:  # 设备额定功率超过限制2倍时发出警告
                    evidence = ViolationEvidence(
                        field_name="max_power_watts",
                        expected_value=f"设备额定功率不应远超过演练限制 {max_power}W",
                        actual_value=device.max_power_watts,
                        context=f"设备 {device.device_id} 额定功率较高",
                    )

                    warning = self.create_violation(
                        violation_type=ViolationType.POWER_EXCEEDED,
                        message=f"设备额定功率警告: {device.max_power_watts}W 远超过演练限制 {max_power}W",
                        severity=ViolationSeverity.LOW,
                        call_sign=device.call_sign,
                        evidence=evidence,
                    )
                    result.add_warning(warning)

        self._end_execution(result)
        result.metadata["max_power_limit"] = max_power

        return result

    def _get_max_power_limit(self, context: RuleContext) -> float:
        """获取最大功率限制"""
        if context.project_config:
            return context.project_config.max_power_watts
        return 25.0  # 默认25瓦

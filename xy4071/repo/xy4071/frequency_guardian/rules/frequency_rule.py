"""频率频段规则"""

from typing import Any, Dict, List, Optional, Tuple

from ..models.violation import ViolationEvidence, ViolationSeverity, ViolationType
from .base import BaseRule, RuleCategory, RuleContext, RuleResult


class FrequencyBandRule(BaseRule[Any]):
    """频率频段验证规则"""

    def __init__(self, **kwargs):
        super().__init__(
            name="频率频段验证",
            code="RULE_FREQUENCY_BAND",
            category=RuleCategory.DATA_VALIDATION,
            description="验证频率是否在允许的频段范围内",
            severity=ViolationSeverity.HIGH,
            **kwargs,
        )

    def applies_to(self, context: RuleContext) -> bool:
        """检查是否适用"""
        return (
            context.frequency_plan is not None
            or context.contact_log is not None
        )

    def execute(self, context: RuleContext) -> RuleResult:
        """执行规则"""
        result = self.create_result()
        self._start_execution(result)

        # 获取频段范围
        min_freq, max_freq = self._get_frequency_band(context)

        # 检查频率计划中的频道
        if context.frequency_plan:
            for channel in context.frequency_plan.channels:
                # 检查主频率
                if not self._is_in_band(channel.frequency_mhz, min_freq, max_freq):
                    evidence = ViolationEvidence(
                        field_name="frequency_mhz",
                        expected_value=f"{min_freq}-{max_freq} MHz",
                        actual_value=channel.frequency_mhz,
                        context=f"频道 {channel.channel_id} 频率超出频段",
                    )

                    violation = self.create_violation(
                        violation_type=ViolationType.FREQUENCY_OUT_OF_BAND,
                        message=f"频道频率超出频段: {channel.frequency_mhz} MHz (允许范围: {min_freq}-{max_freq} MHz)",
                        channel_id=channel.channel_id,
                        evidence=evidence,
                    )
                    result.add_violation(violation)

                # 检查中继台频率
                if channel.is_repeater:
                    if channel.repeater_input_mhz and not self._is_in_band(channel.repeater_input_mhz, min_freq, max_freq):
                        evidence = ViolationEvidence(
                            field_name="repeater_input_mhz",
                            expected_value=f"{min_freq}-{max_freq} MHz",
                            actual_value=channel.repeater_input_mhz,
                            context=f"频道 {channel.channel_id} 中继台上行频率超出频段",
                        )

                        violation = self.create_violation(
                            violation_type=ViolationType.FREQUENCY_OUT_OF_BAND,
                            message=f"中继台上行频率超出频段: {channel.repeater_input_mhz} MHz (允许范围: {min_freq}-{max_freq} MHz)",
                            channel_id=channel.channel_id,
                            evidence=evidence,
                        )
                        result.add_violation(violation)

                    if channel.repeater_output_mhz and not self._is_in_band(channel.repeater_output_mhz, min_freq, max_freq):
                        evidence = ViolationEvidence(
                            field_name="repeater_output_mhz",
                            expected_value=f"{min_freq}-{max_freq} MHz",
                            actual_value=channel.repeater_output_mhz,
                            context=f"频道 {channel.channel_id} 中继台下行频率超出频段",
                        )

                        violation = self.create_violation(
                            violation_type=ViolationType.FREQUENCY_OUT_OF_BAND,
                            message=f"中继台下行频率超出频段: {channel.repeater_output_mhz} MHz (允许范围: {min_freq}-{max_freq} MHz)",
                            channel_id=channel.channel_id,
                            evidence=evidence,
                        )
                        result.add_violation(violation)

        # 检查通联日志中的频率
        if context.contact_log:
            for entry in context.contact_log.entries:
                if not self._is_in_band(entry.frequency_mhz, min_freq, max_freq):
                    evidence = ViolationEvidence(
                        field_name="frequency_mhz",
                        expected_value=f"{min_freq}-{max_freq} MHz",
                        actual_value=entry.frequency_mhz,
                        context=f"通联记录频率超出频段",
                    )

                    violation = self.create_violation(
                        violation_type=ViolationType.FREQUENCY_OUT_OF_BAND,
                        message=f"通联频率超出频段: {entry.frequency_mhz} MHz (允许范围: {min_freq}-{max_freq} MHz)",
                        call_sign=entry.call_sign_own,
                        date=entry.date,
                        time_start=entry.time_start,
                        evidence=evidence,
                    )
                    result.add_violation(violation)

        self._end_execution(result)
        result.metadata["min_frequency"] = min_freq
        result.metadata["max_frequency"] = max_freq

        return result

    def _get_frequency_band(self, context: RuleContext) -> Tuple[float, float]:
        """获取允许的频段范围"""
        if context.project_config:
            return context.project_config.min_frequency_mhz, context.project_config.max_frequency_mhz
        return 144.0, 148.0  # 默认2米频段

    def _is_in_band(self, frequency: float, min_freq: float, max_freq: float) -> bool:
        """检查频率是否在频段范围内"""
        return min_freq <= frequency <= max_freq

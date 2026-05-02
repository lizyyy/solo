"""呼号格式验证规则"""

import re
from typing import Any, Dict, List, Optional

from ..models.violation import ViolationEvidence, ViolationSeverity, ViolationType
from .base import BaseRule, RuleCategory, RuleContext, RuleResult


class CallSignFormatRule(BaseRule[Any]):
    """呼号格式验证规则"""

    def __init__(self, **kwargs):
        super().__init__(
            name="呼号格式验证",
            code="RULE_CALL_SIGN_FORMAT",
            category=RuleCategory.CALL_SIGN,
            description="验证所有呼号格式是否符合业余无线电呼号规范",
            severity=ViolationSeverity.HIGH,
            **kwargs,
        )

    def applies_to(self, context: RuleContext) -> bool:
        """检查是否适用"""
        # 只要有任何数据源就适用
        return (
            context.radio_inventory is not None
            or context.frequency_plan is not None
            or context.duty_schedule is not None
            or context.contact_log is not None
        )

    def execute(self, context: RuleContext) -> RuleResult:
        """执行规则"""
        result = self.create_result()
        self._start_execution(result)

        # 获取呼号模式
        call_sign_pattern = self._get_call_sign_pattern(context)

        # 收集所有需要检查的呼号
        call_signs_to_check: List[Dict[str, Any]] = []

        # 从设备清单收集
        if context.radio_inventory:
            for device in context.radio_inventory.devices:
                call_signs_to_check.append({
                    "call_sign": device.call_sign,
                    "source": "radio_inventory",
                    "source_id": device.device_id,
                    "context": f"设备: {device.device_id}",
                })

        # 从频率分配收集
        if context.frequency_plan:
            for assignment in context.frequency_plan.assignments:
                call_signs_to_check.append({
                    "call_sign": assignment.call_sign,
                    "source": "frequency_assignment",
                    "source_id": assignment.assignment_id,
                    "context": f"分配: {assignment.assignment_id}",
                })

        # 从排班表收集
        if context.duty_schedule:
            for shift in context.duty_schedule.shifts:
                call_signs_to_check.append({
                    "call_sign": shift.call_sign,
                    "source": "duty_schedule",
                    "source_id": shift.shift_id,
                    "context": f"班次: {shift.shift_id}, 日期: {shift.date}",
                    "date": shift.date,
                    "time_start": shift.start_time,
                    "time_end": shift.end_time,
                })

        # 从通联日志收集
        if context.contact_log:
            for entry in context.contact_log.entries:
                # 检查己方呼号
                call_signs_to_check.append({
                    "call_sign": entry.call_sign_own,
                    "source": "contact_log",
                    "source_id": entry.entry_id,
                    "context": f"日志条目: {entry.entry_id} (己方呼号)",
                    "date": entry.date,
                    "time_start": entry.time_start,
                    "channel_id": None,
                })
                # 检查对方呼号
                call_signs_to_check.append({
                    "call_sign": entry.call_sign_other,
                    "source": "contact_log",
                    "source_id": entry.entry_id,
                    "context": f"日志条目: {entry.entry_id} (对方呼号)",
                    "date": entry.date,
                    "time_start": entry.time_start,
                    "channel_id": None,
                })

        # 验证每个呼号
        for item in call_signs_to_check:
            call_sign = item["call_sign"]
            is_valid, invalid_reason = self._validate_call_sign(call_sign, call_sign_pattern)

            if not is_valid:
                evidence = ViolationEvidence(
                    field_name="call_sign",
                    expected_value="符合业余无线电呼号规范",
                    actual_value=call_sign,
                    context=invalid_reason,
                )

                violation = self.create_violation(
                    violation_type=ViolationType.CALL_SIGN_INVALID,
                    message=f"呼号格式无效: {call_sign} - {invalid_reason}",
                    call_sign=call_sign,
                    evidence=evidence,
                    date=item.get("date"),
                    time_start=item.get("time_start"),
                    time_end=item.get("time_end"),
                )
                result.add_violation(violation)

        self._end_execution(result)
        result.metadata["checked_count"] = len(call_signs_to_check)
        result.metadata["invalid_count"] = result.get_violation_count()

        return result

    def _get_call_sign_pattern(self, context: RuleContext) -> re.Pattern:
        """获取呼号正则表达式模式"""
        if context.project_config:
            pattern_str = context.project_config.call_sign_pattern
        else:
            # 默认模式：中国业余无线电呼号格式
            # 格式1: 前缀(1-2字母) + 数字 + 后缀(1-4字母)
            # 格式2: 带斜杠的呼号（如 B1ABC/P 或 P/B1ABC）
            pattern_str = r"^[A-Z0-9]+/[A-Z0-9]+$|^[A-Z]{1,2}[0-9][A-Z]{1,4}$"

        return re.compile(pattern_str)

    def _validate_call_sign(self, call_sign: str, pattern: re.Pattern) -> tuple:
        """
        验证呼号格式

        Returns:
            (is_valid: bool, invalid_reason: str)
        """
        if not call_sign:
            return False, "呼号为空"

        call_sign = call_sign.strip().upper()

        if not call_sign:
            return False, "呼号为空字符串"

        # 基础格式检查
        if not pattern.match(call_sign):
            # 检查常见错误
            if " " in call_sign:
                return False, "呼号包含空格"
            if "_" in call_sign:
                return False, "呼号包含下划线"
            if len(call_sign) < 3:
                return False, "呼号长度不足（至少3个字符）"
            if len(call_sign) > 15:
                return False, "呼号长度过长（不超过15个字符）"
            if not any(c.isdigit() for c in call_sign) and "/" not in call_sign:
                return False, "呼号缺少数字（非斜杠格式的呼号必须包含数字）"

            return False, "格式不符合规范"

        # 额外检查：是否包含非法字符
        allowed_chars = set("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/-")
        for char in call_sign:
            if char not in allowed_chars:
                return False, f"包含非法字符: '{char}'"

        return True, ""

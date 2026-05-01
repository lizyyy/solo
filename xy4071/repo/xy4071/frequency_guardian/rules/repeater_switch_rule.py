"""中继台切换规则"""

from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from ..models.log import ContactLogEntry
from ..models.violation import ViolationEvidence, ViolationSeverity, ViolationType
from .base import BaseRule, RuleCategory, RuleContext, RuleResult


@dataclass
class RepeaterSwitchInfo:
    """中继台切换信息"""

    call_sign: str
    date: str
    entry: ContactLogEntry
    previous_repeater_id: Optional[str]
    current_repeater_id: Optional[str]
    has_switch_record: bool


class RepeaterSwitchRule(BaseRule[Any]):
    """中继台切换记录检查规则"""

    def __init__(self, **kwargs):
        super().__init__(
            name="中继台切换记录检查",
            code="RULE_REPEATER_SWITCH",
            category=RuleCategory.REPEATER_CHECK,
            description="检查跨中继台切换是否有记录",
            severity=ViolationSeverity.MEDIUM,
            **kwargs,
        )

    def applies_to(self, context: RuleContext) -> bool:
        """检查是否适用"""
        return context.contact_log is not None

    def execute(self, context: RuleContext) -> RuleResult:
        """执行规则"""
        result = self.create_result()
        self._start_execution(result)

        if not context.contact_log:
            self._end_execution(result)
            return result

        # 获取所有中继台
        repeaters = self._get_repeaters(context)

        # 按呼号和日期分组
        call_sign_date_entries: Dict[Tuple[str, str], List[ContactLogEntry]] = {}

        for entry in context.contact_log.entries:
            key = (entry.call_sign_own, entry.date)
            if key not in call_sign_date_entries:
                call_sign_date_entries[key] = []
            call_sign_date_entries[key].append(entry)

        # 检测缺失的中继台切换记录
        missing_switches: List[RepeaterSwitchInfo] = []

        for (call_sign, date), entries in call_sign_date_entries.items():
            if len(entries) < 2:
                continue

            # 按时间排序
            sorted_entries = sorted(entries, key=lambda e: e.time_start)

            # 检查相邻条目是否有中继台切换
            for i in range(len(sorted_entries) - 1):
                current = sorted_entries[i]
                next_entry = sorted_entries[i + 1]

                current_repeater = self._get_entry_repeater(current, repeaters, context)
                next_repeater = self._get_entry_repeater(next_entry, repeaters, context)

                # 检查是否有中继台切换
                if current_repeater != next_repeater and current_repeater is not None and next_repeater is not None:
                    # 检查下一条目是否有切换记录
                    has_switch_record = next_entry.repeater_switch

                    if not has_switch_record:
                        missing_switches.append(RepeaterSwitchInfo(
                            call_sign=call_sign,
                            date=date,
                            entry=next_entry,
                            previous_repeater_id=current_repeater,
                            current_repeater_id=next_repeater,
                            has_switch_record=False,
                        ))

        # 生成违规记录
        for missing in missing_switches:
            evidence = ViolationEvidence(
                field_name="repeater_switch",
                expected_value="跨中继台切换应有记录标记",
                actual_value=f"从中继台 {missing.previous_repeater_id} 切换到 {missing.current_repeater_id}，但没有切换记录",
                context=f"呼号 {missing.call_sign} 在 {missing.date} 期间发生中继台切换",
                related_entries=[
                    {
                        "entry_id": missing.entry.entry_id,
                        "time_start": missing.entry.time_start,
                        "frequency_mhz": missing.entry.frequency_mhz,
                        "repeater_switch": missing.entry.repeater_switch,
                    },
                ],
            )

            violation = self.create_violation(
                violation_type=ViolationType.REPEATER_SWITCH_MISSING,
                message=f"中继台切换记录缺失: 呼号 {missing.call_sign} 在 {missing.date} 从 {missing.previous_repeater_id} 切换到 {missing.current_repeater_id} 但无记录",
                severity=ViolationSeverity.MEDIUM,
                call_sign=missing.call_sign,
                date=missing.date,
                time_start=missing.entry.time_start,
                evidence=evidence,
            )
            result.add_violation(violation)

        self._end_execution(result)
        result.metadata["total_entries_checked"] = len(context.contact_log.entries)
        result.metadata["missing_switch_count"] = len(missing_switches)
        result.metadata["repeaters_identified"] = len(repeaters)

        return result

    def _get_repeaters(self, context: RuleContext) -> Dict[str, Dict[str, Any]]:
        """获取所有中继台信息"""
        repeaters: Dict[str, Dict[str, Any]] = {}

        if context.radio_inventory:
            for device in context.radio_inventory.devices:
                if device.is_repeater:
                    repeaters[device.device_id] = {
                        "device_id": device.device_id,
                        "call_sign": device.call_sign,
                        "location": device.location,
                    }

        if context.frequency_plan:
            for channel in context.frequency_plan.channels:
                if channel.is_repeater:
                    if channel.channel_id not in repeaters:
                        repeaters[channel.channel_id] = {
                            "channel_id": channel.channel_id,
                            "frequency_mhz": channel.frequency_mhz,
                            "repeater_input_mhz": channel.repeater_input_mhz,
                            "repeater_output_mhz": channel.repeater_output_mhz,
                        }

        return repeaters

    def _get_entry_repeater(
        self,
        entry: ContactLogEntry,
        repeaters: Dict[str, Dict[str, Any]],
        context: RuleContext,
    ) -> Optional[str]:
        """
        获取日志条目使用的中继台

        Returns:
            中继台ID，如果不是通过中继台通信则返回 None
        """
        # 1. 优先使用条目中的 repeater_id 字段
        if entry.repeater_id:
            return entry.repeater_id

        # 2. 根据频率查找中继台
        if context.frequency_plan:
            channel = context.frequency_plan.get_channel_by_frequency(entry.frequency_mhz)
            if channel and channel.is_repeater:
                return channel.channel_id

        # 3. 检查设备清单中是否有中继台使用该频率
        # (这里简化处理，假设直接通过频率匹配)

        return None

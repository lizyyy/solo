"""频道冲突规则"""

from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

from ..models.schedule import DutyShift
from ..models.violation import ViolationEvidence, ViolationSeverity, ViolationType
from .base import BaseRule, RuleCategory, RuleContext, RuleResult


@dataclass
class ChannelConflict:
    """频道冲突"""

    channel_id: str
    date: str
    shift1: DutyShift
    shift2: DutyShift
    overlap_start: str
    overlap_end: str


class ChannelConflictRule(BaseRule[Any]):
    """频道冲突检测规则"""

    def __init__(self, **kwargs):
        super().__init__(
            name="频道冲突检测",
            code="RULE_CHANNEL_CONFLICT",
            category=RuleCategory.SCHEDULE_CONFLICT,
            description="检测同一频道在同一时段是否有多个值守排班",
            severity=ViolationSeverity.CRITICAL,
            **kwargs,
        )

    def applies_to(self, context: RuleContext) -> bool:
        """检查是否适用"""
        return context.duty_schedule is not None

    def execute(self, context: RuleContext) -> RuleResult:
        """执行规则"""
        result = self.create_result()
        self._start_execution(result)

        if not context.duty_schedule:
            self._end_execution(result)
            return result

        # 按频道和日期分组
        channel_date_shifts: Dict[Tuple[str, str], List[DutyShift]] = {}

        for shift in context.duty_schedule.shifts:
            # 忽略备班
            if shift.is_backup:
                continue

            key = (shift.channel_id, shift.date)
            if key not in channel_date_shifts:
                channel_date_shifts[key] = []
            channel_date_shifts[key].append(shift)

        # 检测冲突
        conflicts: List[ChannelConflict] = []

        for (channel_id, date), shifts in channel_date_shifts.items():
            if len(shifts) < 2:
                continue

            # 按开始时间排序
            sorted_shifts = sorted(shifts, key=lambda s: s.start_time)

            # 检查每对班次是否有时间重叠
            for i in range(len(sorted_shifts)):
                for j in range(i + 1, len(sorted_shifts)):
                    shift1 = sorted_shifts[i]
                    shift2 = sorted_shifts[j]

                    overlap = self._check_time_overlap(
                        shift1.start_time, shift1.end_time,
                        shift2.start_time, shift2.end_time,
                    )

                    if overlap:
                        overlap_start, overlap_end = overlap
                        conflicts.append(ChannelConflict(
                            channel_id=channel_id,
                            date=date,
                            shift1=shift1,
                            shift2=shift2,
                            overlap_start=overlap_start,
                            overlap_end=overlap_end,
                        ))

        # 生成违规记录
        for conflict in conflicts:
            evidence = ViolationEvidence(
                field_name="channel_id",
                expected_value="同一频道同一时段只能有一个主班值守",
                actual_value=f"频道 {conflict.channel_id} 在 {conflict.date} {conflict.overlap_start}-{conflict.overlap_end} 有重叠",
                context=f"班次1: {conflict.shift1.shift_id} ({conflict.shift1.call_sign}), 班次2: {conflict.shift2.shift_id} ({conflict.shift2.call_sign})",
                related_entries=[
                    {
                        "shift_id": conflict.shift1.shift_id,
                        "call_sign": conflict.shift1.call_sign,
                        "start_time": conflict.shift1.start_time,
                        "end_time": conflict.shift1.end_time,
                    },
                    {
                        "shift_id": conflict.shift2.shift_id,
                        "call_sign": conflict.shift2.call_sign,
                        "start_time": conflict.shift2.start_time,
                        "end_time": conflict.shift2.end_time,
                    },
                ],
            )

            violation = self.create_violation(
                violation_type=ViolationType.CHANNEL_CONFLICT,
                message=f"频道冲突: 频道 {conflict.channel_id} 在 {conflict.date} {conflict.overlap_start}-{conflict.overlap_end} 有值守重叠 (呼号: {conflict.shift1.call_sign} & {conflict.shift2.call_sign})",
                severity=ViolationSeverity.CRITICAL,
                channel_id=conflict.channel_id,
                date=conflict.date,
                time_start=conflict.overlap_start,
                time_end=conflict.overlap_end,
                evidence=evidence,
            )
            result.add_violation(violation)

        self._end_execution(result)
        result.metadata["total_shifts_checked"] = len(context.duty_schedule.shifts)
        result.metadata["conflict_count"] = len(conflicts)

        return result

    def _check_time_overlap(
        self,
        start1: str,
        end1: str,
        start2: str,
        end2: str,
    ) -> Optional[Tuple[str, str]]:
        """
        检查两个时间段是否重叠

        Returns:
            如果重叠，返回 (重叠开始时间, 重叠结束时间)，否则返回 None
        """
        # 解析时间为分钟数
        start1_min = self._time_to_minutes(start1)
        end1_min = self._time_to_minutes(end1)
        start2_min = self._time_to_minutes(start2)
        end2_min = self._time_to_minutes(end2)

        # 检查是否有重叠
        if start1_min is None or end1_min is None or start2_min is None or end2_min is None:
            return None

        # 计算重叠
        overlap_start = max(start1_min, start2_min)
        overlap_end = min(end1_min, end2_min)

        if overlap_start < overlap_end:
            return (
                self._minutes_to_time(overlap_start),
                self._minutes_to_time(overlap_end),
            )

        return None

    def _time_to_minutes(self, time_str: str) -> Optional[int]:
        """将时间字符串转换为分钟数"""
        try:
            parts = time_str.split(":")
            if len(parts) >= 2:
                hours = int(parts[0])
                minutes = int(parts[1])
                return hours * 60 + minutes
        except (ValueError, IndexError):
            pass
        return None

    def _minutes_to_time(self, minutes: int) -> str:
        """将分钟数转换为时间字符串"""
        hours = minutes // 60
        mins = minutes % 60
        return f"{hours:02d}:{mins:02d}"

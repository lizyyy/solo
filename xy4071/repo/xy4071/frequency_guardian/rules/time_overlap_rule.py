"""时间重叠规则（用于频率分配）"""

from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

from ..models.frequency import FrequencyAssignment
from ..models.violation import ViolationEvidence, ViolationSeverity, ViolationType
from .base import BaseRule, RuleCategory, RuleContext, RuleResult


@dataclass
class TimeOverlap:
    """时间重叠"""

    channel_id: str
    assignment1: FrequencyAssignment
    assignment2: FrequencyAssignment
    overlap_days: List[str]
    overlap_start: str
    overlap_end: str


class TimeOverlapRule(BaseRule[Any]):
    """频率分配时间重叠检测规则"""

    def __init__(self, **kwargs):
        super().__init__(
            name="频率分配时间重叠检测",
            code="RULE_TIME_OVERLAP",
            category=RuleCategory.FREQUENCY_CONFLICT,
            description="检测同一频道的频率分配是否有时间重叠",
            severity=ViolationSeverity.HIGH,
            **kwargs,
        )

    def applies_to(self, context: RuleContext) -> bool:
        """检查是否适用"""
        return context.frequency_plan is not None and len(context.frequency_plan.assignments) > 0

    def execute(self, context: RuleContext) -> RuleResult:
        """执行规则"""
        result = self.create_result()
        self._start_execution(result)

        if not context.frequency_plan or not context.frequency_plan.assignments:
            self._end_execution(result)
            return result

        # 按频道分组
        channel_assignments: Dict[str, List[FrequencyAssignment]] = {}

        for assignment in context.frequency_plan.assignments:
            channel_id = assignment.channel_id
            if channel_id not in channel_assignments:
                channel_assignments[channel_id] = []
            channel_assignments[channel_id].append(assignment)

        # 检测重叠
        overlaps: List[TimeOverlap] = []

        for channel_id, assignments in channel_assignments.items():
            if len(assignments) < 2:
                continue

            # 按开始时间排序
            sorted_assignments = sorted(assignments, key=lambda a: a.start_time)

            # 检查每对分配是否有时间重叠
            for i in range(len(sorted_assignments)):
                for j in range(i + 1, len(sorted_assignments)):
                    assign1 = sorted_assignments[i]
                    assign2 = sorted_assignments[j]

                    overlap = self._check_overlap(assign1, assign2)

                    if overlap:
                        overlap_days, overlap_start, overlap_end = overlap
                        overlaps.append(TimeOverlap(
                            channel_id=channel_id,
                            assignment1=assign1,
                            assignment2=assign2,
                            overlap_days=overlap_days,
                            overlap_start=overlap_start,
                            overlap_end=overlap_end,
                        ))

        # 生成违规记录
        for overlap in overlaps:
            evidence = ViolationEvidence(
                field_name="time",
                expected_value="同一频道的频率分配不应有时间重叠",
                actual_value=f"频道 {overlap.channel_id} 在 {overlap.overlap_days} {overlap.overlap_start}-{overlap.overlap_end} 有重叠",
                context=f"分配1: {overlap.assignment1.assignment_id} ({overlap.assignment1.call_sign}), 分配2: {overlap.assignment2.assignment_id} ({overlap.assignment2.call_sign})",
                related_entries=[
                    {
                        "assignment_id": overlap.assignment1.assignment_id,
                        "call_sign": overlap.assignment1.call_sign,
                        "days": overlap.assignment1.days,
                        "start_time": overlap.assignment1.start_time,
                        "end_time": overlap.assignment1.end_time,
                    },
                    {
                        "assignment_id": overlap.assignment2.assignment_id,
                        "call_sign": overlap.assignment2.call_sign,
                        "days": overlap.assignment2.days,
                        "start_time": overlap.assignment2.start_time,
                        "end_time": overlap.assignment2.end_time,
                    },
                ],
            )

            violation = self.create_violation(
                violation_type=ViolationType.TIME_OVERLAP,
                message=f"频率分配时间重叠: 频道 {overlap.channel_id} 在 {overlap.overlap_days} {overlap.overlap_start}-{overlap.overlap_end} 有重叠 (呼号: {overlap.assignment1.call_sign} & {overlap.assignment2.call_sign})",
                severity=ViolationSeverity.HIGH,
                channel_id=overlap.channel_id,
                evidence=evidence,
            )
            result.add_violation(violation)

        self._end_execution(result)
        result.metadata["total_assignments_checked"] = len(context.frequency_plan.assignments)
        result.metadata["overlap_count"] = len(overlaps)

        return result

    def _check_overlap(
        self,
        assign1: FrequencyAssignment,
        assign2: FrequencyAssignment,
    ) -> Optional[Tuple[List[str], str, str]]:
        """
        检查两个频率分配是否有时间重叠

        Returns:
            如果重叠，返回 (重叠日期列表, 重叠开始时间, 重叠结束时间)，否则返回 None
        """
        # 检查日期重叠
        days1 = set(assign1.days)
        days2 = set(assign2.days)
        overlap_days = sorted(list(days1 & days2))

        if not overlap_days:
            return None

        # 检查时间重叠
        start1_min = self._time_to_minutes(assign1.start_time)
        end1_min = self._time_to_minutes(assign1.end_time)
        start2_min = self._time_to_minutes(assign2.start_time)
        end2_min = self._time_to_minutes(assign2.end_time)

        if start1_min is None or end1_min is None or start2_min is None or end2_min is None:
            return None

        overlap_start = max(start1_min, start2_min)
        overlap_end = min(end1_min, end2_min)

        if overlap_start < overlap_end:
            return (
                overlap_days,
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

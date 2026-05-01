"""排班规划器"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from ..models.config import ProjectConfig
from ..models.frequency import FrequencyPlan
from ..models.schedule import DutySchedule, DutyShift


@dataclass
class ShiftSuggestion:
    """班次建议"""

    suggestion_id: str
    channel_id: str
    date: str
    time_start: str
    time_end: str

    suggested_call_sign: Optional[str] = None
    suggested_operator: Optional[str] = None

    reason: str = ""
    confidence: float = 1.0

    alternatives: List[Dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "suggestion_id": self.suggestion_id,
            "channel_id": self.channel_id,
            "date": self.date,
            "time_start": self.time_start,
            "time_end": self.time_end,
            "suggested_call_sign": self.suggested_call_sign,
            "suggested_operator": self.suggested_operator,
            "reason": self.reason,
            "confidence": self.confidence,
            "alternatives": self.alternatives,
        }


@dataclass
class PlanningResult:
    """规划结果"""

    generated_at: datetime = field(default_factory=datetime.now)

    suggestions: List[ShiftSuggestion] = field(default_factory=list)
    conflicts_resolved: int = 0
    gaps_filled: int = 0

    summary: Dict[str, Any] = field(default_factory=dict)


class SchedulePlanner:
    """排班规划器"""

    def __init__(
        self,
        duty_schedule: DutySchedule,
        frequency_plan: Optional[FrequencyPlan] = None,
        project_config: Optional[ProjectConfig] = None,
    ):
        """
        初始化排班规划器

        Args:
            duty_schedule: 值守排班表
            frequency_plan: 频率计划
            project_config: 项目配置
        """
        self.duty_schedule = duty_schedule
        self.frequency_plan = frequency_plan
        self.project_config = project_config

    def _minutes_to_time(self, minutes: int) -> str:
        """将分钟数转换为时间字符串"""
        hours = minutes // 60
        mins = minutes % 60
        return f"{hours:02d}:{mins:02d}"

    def _time_to_minutes(self, time_str: str) -> Optional[int]:
        """将时间字符串转换为分钟数"""
        try:
            parts = time_str.split(":")
            if len(parts) >= 2:
                hours = int(parts[0])
                mins = int(parts[1])
                return hours * 60 + mins
        except (ValueError, IndexError):
            pass
        return None

    def analyze_gaps(self) -> List[Dict[str, Any]]:
        """
        分析排班空档

        Returns:
            空档列表
        """
        gaps: List[Dict[str, Any]] = []

        # 获取所有日期和频道
        dates = self.duty_schedule.get_dates()
        channel_ids = {s.channel_id for s in self.duty_schedule.shifts}

        for date in dates:
            for channel_id in channel_ids:
                # 获取该日期和频道的所有班次
                shifts = [
                    s for s in self.duty_schedule.shifts
                    if s.date == date and s.channel_id == channel_id and not s.is_backup
                ]

                if not shifts:
                    # 该频道该日期完全没有排班，全天都是空档
                    gaps.append({
                        "date": date,
                        "channel_id": channel_id,
                        "time_start": "00:00",
                        "time_end": "24:00",
                        "duration_minutes": 24 * 60,
                        "type": "full_day_gap",
                    })
                    continue

                # 按开始时间排序
                sorted_shifts = sorted(shifts, key=lambda s: s.start_time)

                # 检查班次之间的空档
                for i in range(len(sorted_shifts) - 1):
                    current = sorted_shifts[i]
                    next_shift = sorted_shifts[i + 1]

                    current_end = self._time_to_minutes(current.end_time)
                    next_start = self._time_to_minutes(next_shift.start_time)

                    if current_end is not None and next_start is not None:
                        if next_start > current_end:
                            # 有空档
                            gaps.append({
                                "date": date,
                                "channel_id": channel_id,
                                "time_start": self._minutes_to_time(current_end),
                                "time_end": self._minutes_to_time(next_start),
                                "duration_minutes": next_start - current_end,
                                "type": "between_shifts_gap",
                                "prev_shift_id": current.shift_id,
                                "next_shift_id": next_shift.shift_id,
                            })

                # 检查开始前的空档
                first_shift = sorted_shifts[0]
                first_start = self._time_to_minutes(first_shift.start_time)
                if first_start is not None and first_start > 0:
                    gaps.append({
                        "date": date,
                        "channel_id": channel_id,
                        "time_start": "00:00",
                        "time_end": first_shift.start_time,
                        "duration_minutes": first_start,
                        "type": "before_first_shift_gap",
                        "next_shift_id": first_shift.shift_id,
                    })

                # 检查结束后的空档
                last_shift = sorted_shifts[-1]
                last_end = self._time_to_minutes(last_shift.end_time)
                if last_end is not None and last_end < 24 * 60:
                    gaps.append({
                        "date": date,
                        "channel_id": channel_id,
                        "time_start": last_shift.end_time,
                        "time_end": "24:00",
                        "duration_minutes": 24 * 60 - last_end,
                        "type": "after_last_shift_gap",
                        "prev_shift_id": last_shift.shift_id,
                    })

        return gaps

    def suggest_fills_for_gaps(
        self,
        gaps: Optional[List[Dict[str, Any]]] = None,
        min_duration_minutes: int = 30,
    ) -> PlanningResult:
        """
        为空档提供填充建议

        Args:
            gaps: 空档列表（如果为None则自动分析）
            min_duration_minutes: 最小空档时长（分钟）

        Returns:
            规划结果
        """
        result = PlanningResult()

        if gaps is None:
            gaps = self.analyze_gaps()

        # 过滤空档（只考虑达到最小时长的空档）
        significant_gaps = [
            g for g in gaps
            if g.get("duration_minutes", 0) >= min_duration_minutes
        ]

        # 获取可用操作员
        available_operators = self._get_available_operators()

        # 为每个空档生成建议
        for gap in significant_gaps:
            suggestion = ShiftSuggestion(
                suggestion_id=f"SUG_{gap['date']}_{gap['time_start']}_{gap['channel_id']}",
                channel_id=gap["channel_id"],
                date=gap["date"],
                time_start=gap["time_start"],
                time_end=gap["time_end"],
                reason=f"填充空档 ({gap['duration_minutes']} 分钟)",
                confidence=0.5,
            )

            # 查找合适的操作员
            suitable_operators = self._find_suitable_operators(
                gap,
                available_operators,
            )

            if suitable_operators:
                best = suitable_operators[0]
                suggestion.suggested_call_sign = best.get("call_sign")
                suggestion.suggested_operator = best.get("operator_name")
                suggestion.confidence = best.get("score", 0.5)
                suggestion.alternatives = suitable_operators[1:3]  # 最多3个备选

            result.suggestions.append(suggestion)
            result.gaps_filled += 1

        # 生成摘要
        result.summary = {
            "total_gaps": len(significant_gaps),
            "gaps_with_suggestions": len(result.suggestions),
            "min_duration_minutes": min_duration_minutes,
        }

        return result

    def _get_available_operators(self) -> List[Dict[str, Any]]:
        """获取可用操作员"""
        operators: Dict[str, Dict[str, Any]] = {}

        for shift in self.duty_schedule.shifts:
            call_sign = shift.call_sign
            if call_sign not in operators:
                operators[call_sign] = {
                    "call_sign": call_sign,
                    "operator_name": shift.operator_name,
                    "shifts_count": 0,
                    "channel_history": set(),
                    "date_history": set(),
                }
            operators[call_sign]["shifts_count"] += 1
            operators[call_sign]["channel_history"].add(shift.channel_id)
            operators[call_sign]["date_history"].add(shift.date)

        # 转换为列表并按排班次数排序（排班少的优先级高）
        result = sorted(
            operators.values(),
            key=lambda x: x["shifts_count"],
        )

        # 添加分数
        for i, op in enumerate(result):
            op["score"] = 1.0 - (i / len(result) if result else 0)

        return result

    def _find_suitable_operators(
        self,
        gap: Dict[str, Any],
        operators: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """
        查找适合填充空档的操作员

        Args:
            gap: 空档信息
            operators: 可用操作员列表

        Returns:
            适合的操作员列表（按适合程度排序）
        """
        suitable: List[Dict[str, Any]] = []

        gap_date = gap["date"]
        gap_channel = gap["channel_id"]
        gap_start = self._time_to_minutes(gap["time_start"])
        gap_end = self._time_to_minutes(gap["time_end"])

        for op in operators:
            # 检查该操作员在该日期是否有时间冲突
            has_conflict = False
            for shift in self.duty_schedule.shifts:
                if shift.call_sign == op["call_sign"] and shift.date == gap_date:
                    shift_start = self._time_to_minutes(shift.start_time)
                    shift_end = self._time_to_minutes(shift.end_time)

                    if (
                        gap_start is not None
                        and gap_end is not None
                        and shift_start is not None
                        and shift_end is not None
                    ):
                        # 检查时间重叠
                        if gap_start < shift_end and gap_end > shift_start:
                            has_conflict = True
                            break

            if has_conflict:
                continue

            # 计算适合度分数
            score = op.get("score", 0.5)

            # 如果该操作员有该频道的历史，加分
            channel_history = op.get("channel_history", set())
            if gap_channel in channel_history:
                score += 0.3

            # 如果该操作员有该日期的历史，加分（说明当天可以值班）
            date_history = op.get("date_history", set())
            if gap_date in date_history:
                score += 0.1

            suitable.append({
                "call_sign": op["call_sign"],
                "operator_name": op.get("operator_name"),
                "score": min(1.0, score),
                "has_channel_experience": gap_channel in channel_history,
                "has_date_experience": gap_date in date_history,
            })

        # 按分数排序
        return sorted(suitable, key=lambda x: x["score"], reverse=True)

    def suggest_rearrangements_for_conflicts(
        self,
        conflicts: Optional[List[Dict[str, Any]]] = None,
    ) -> PlanningResult:
        """
        为冲突提供重排建议

        Args:
            conflicts: 冲突列表（如果为None则需要从规则引擎获取）

        Returns:
            规划结果
        """
        result = PlanningResult()

        # 这里是一个简化的实现
        # 实际应用中需要更复杂的算法

        result.summary = {
            "note": "冲突重排建议功能需要结合规则引擎的冲突检测结果",
        }

        return result

    def optimize_schedule(self) -> PlanningResult:
        """
        优化排班

        Returns:
            规划结果
        """
        result = PlanningResult()

        # 分析空档
        gaps = self.analyze_gaps()

        # 生成填充建议
        gap_suggestions = self.suggest_fills_for_gaps(gaps)
        result.suggestions.extend(gap_suggestions.suggestions)
        result.gaps_filled = gap_suggestions.gaps_filled

        # 生成摘要
        result.summary = {
            "total_gaps": len(gaps),
            "significant_gaps": len([g for g in gaps if g.get("duration_minutes", 0) >= 30]),
            "gaps_with_suggestions": len(result.suggestions),
            "operators_available": len(self._get_available_operators()),
        }

        return result

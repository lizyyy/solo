"""核心安全校验计算器。

安全靠泊的核心公式和边界条件：

1. 吃水校验公式：
   可用水深 = 泊位设计水深 + 潮位高度
   要求水深 = 船舶吃水 + 龙骨下富余水深
   水深余量 = 可用水深 - 要求水深
   通过条件：水深余量 >= 0

   边界考虑：
   - 进港航道水深也需满足
   - 考虑潮位预报不确定度，保守计算时减去不确定度

2. 风速校验公式：
   风速余量 = 风速限制 - 实际风速（或阵风，取较大值）
   通过条件：风速余量 >= 0

   边界考虑：
   - 阵风比持续风速更危险，优先校验阵风
   - 船舶操纵性差时适当降低风速限制

3. 时间窗口判定：
   - 连续满足所有条件的时间段为一个靠泊窗口
   - 窗口时长需满足最小靠泊作业时间要求

所有公式、单位、边界条件在本模块集中定义，便于审计和修改。
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import List, Optional, Tuple

import pytz

from .exceptions import (
    DraftExceedError,
    WindSpeedExceedError,
)
from .models import (
    Berth,
    BerthWindow,
    SafetyCheckResult,
    ScheduleNote,
    Ship,
    TideCurve,
    WindForecast,
)


@dataclass
class SafetyThreshold:
    """安全阈值配置。

    所有阈值集中管理，便于统一调整。
    """

    under_keel_margin: float = 0.5  # 龙骨下富余水深，米
    wind_limit_default: float = 15.0  # 默认风速限制，米/秒
    wind_limit_for_poor_maneuver: float = 10.0  # 操纵性差的船舶风速限制
    min_window_minutes: int = 30  # 最小靠泊窗口时长，分钟
    time_step_minutes: int = 10  # 计算时间步长，分钟
    use_uncertainty_buffer: bool = True  # 是否使用不确定度作为安全缓冲
    use_gust_for_wind_check: bool = True  # 是否使用阵风进行风速校验
    channel_depth_check: bool = True  # 是否检查航道水深

    def explain(self) -> str:
        """生成阈值配置说明。"""
        return "\n".join([
            "=== 安全阈值配置 ===",
            f"龙骨下富余水深: {self.under_keel_margin:.2f} m",
            f"默认风速限制: {self.wind_limit_default:.1f} m/s",
            f"操纵性差船舶风速限制: {self.wind_limit_for_poor_maneuver:.1f} m/s",
            f"最小靠泊窗口时长: {self.min_window_minutes} 分钟",
            f"计算时间步长: {self.time_step_minutes} 分钟",
            f"使用潮位不确定度缓冲: {'是' if self.use_uncertainty_buffer else '否'}",
            f"使用阵风校验风速: {'是' if self.use_gust_for_wind_check else '否'}",
            f"检查航道水深: {'是' if self.channel_depth_check else '否'}",
        ])


class SafetyCalculator:
    """安全靠泊计算器。"""

    def __init__(self, threshold: Optional[SafetyThreshold] = None) -> None:
        self.threshold = threshold or SafetyThreshold()

    def get_effective_wind_limit(self, ship: Ship, berth: Berth) -> float:
        """获取有效的风速限制。

        根据船舶操纵性调整风速限制：
        - 操纵性1-2级（差）: 使用较低限制
        - 操纵性3级（中）: 使用泊位默认限制
        - 操纵性4-5级（好）: 可适当放宽（不超过泊位限制的120%）
        """
        base_limit = berth.wind_limit if berth.wind_limit > 0 else self.threshold.wind_limit_default

        if ship.maneuverability <= 2:
            effective = min(base_limit, self.threshold.wind_limit_for_poor_maneuver)
        elif ship.maneuverability >= 4:
            effective = base_limit * 1.2
        else:
            effective = base_limit

        return round(effective, 1)

    def check_point(
        self,
        time: datetime,
        ship: Ship,
        berth: Berth,
        tide_curve: TideCurve,
        wind_forecast: WindForecast,
        notes: Optional[List[ScheduleNote]] = None,
    ) -> SafetyCheckResult:
        """检查单个时间点是否满足安全靠泊条件。

        参数:
            time: 检查时间点
            ship: 船舶信息
            berth: 泊位信息
            tide_curve: 潮位曲线
            wind_forecast: 风速预报
            notes: 调度备注列表

        返回:
            SafetyCheckResult 包含所有校验项的详细结果
        """
        errors: List[str] = []
        warnings: List[str] = []

        # 获取潮位
        tide_level, tide_uncertainty = tide_curve.get_tide_at(time)

        # 获取风速
        wind_speed, wind_direction, wind_gust, wind_uncertainty = wind_forecast.get_wind_at(time)

        # 计算可用水深（泊位设计水深 + 潮位）
        available_depth = berth.design_depth + tide_level

        # 潮位不确定度缓冲（保守计算）
        if self.threshold.use_uncertainty_buffer:
            available_depth -= tide_uncertainty

        # 航道水深检查
        if self.threshold.channel_depth_check and berth.approach_channel_depth > 0:
            channel_available = berth.approach_channel_depth + tide_level
            if self.threshold.use_uncertainty_buffer:
                channel_available -= tide_uncertainty
            available_depth = min(available_depth, channel_available)
            if channel_available < available_depth:
                warnings.append("进港航道水深限制了可用水深")

        # 计算要求水深（船舶吃水 + 富余水深）
        required_margin = berth.under_keel_margin if berth.under_keel_margin > 0 else self.threshold.under_keel_margin
        required_depth = ship.draft + required_margin

        # 吃水校验
        depth_margin = available_depth - required_depth
        draft_check = depth_margin >= -1e-9  # 允许微小浮点误差

        if not draft_check:
            errors.append(
                f"水深不足: 可用 {available_depth:.2f}m < 要求 {required_depth:.2f}m，"
                f"缺口 {abs(depth_margin):.2f}m"
            )

        # 风速校验
        wind_limit = self.get_effective_wind_limit(ship, berth)

        check_wind = wind_speed
        if self.threshold.use_gust_for_wind_check and wind_gust is not None:
            check_wind = max(wind_speed, wind_gust)

        wind_margin = wind_limit - check_wind
        wind_check = wind_margin >= -1e-9

        if not wind_check:
            wind_type = "阵风" if (self.threshold.use_gust_for_wind_check and wind_gust and wind_gust > wind_speed) else "持续风速"
            errors.append(
                f"{wind_type}超限: {check_wind:.1f} m/s > 限制 {wind_limit:.1f} m/s，"
                f"超出 {abs(wind_margin):.1f} m/s"
            )

        # 检查调度备注中的限制
        effective_notes = []
        if notes:
            for note in notes:
                if note.is_effective(time):
                    if note.related_ship and note.related_ship != ship.imo and note.related_ship != ship.name:
                        continue
                    if note.related_berth and note.related_berth != berth.berth_id:
                        continue
                    effective_notes.append(note)

                    if note.priority == 3:  # 紧急备注可能包含禁止靠泊指令
                        if "禁止" in note.content or "不准" in note.content or "取消" in note.content:
                            errors.append(f"紧急调度限制: {note.content}")
                        else:
                            warnings.append(f"紧急调度备注: {note.content}")
                    elif note.priority == 2:
                        warnings.append(f"重要调度备注: {note.content}")

        # 不确定度过高警告
        if tide_uncertainty > 0.3:
            warnings.append(f"潮位预报不确定度较高: ±{tide_uncertainty:.2f}m")
        if wind_uncertainty > 3.0:
            warnings.append(f"风速预报不确定度较高: ±{wind_uncertainty:.1f}m/s")

        # 船舶尺寸校验
        if berth.max_length > 0 and ship.length > berth.max_length:
            errors.append(f"船长超限: {ship.length}m > 泊位最大 {berth.max_length}m")
        if berth.max_beam > 0 and ship.beam > berth.max_beam:
            errors.append(f"船宽超限: {ship.beam}m > 泊位最大 {berth.max_beam}m")

        is_safe = draft_check and wind_check and not any("禁止" in e for e in errors)

        return SafetyCheckResult(
            time=time,
            is_safe=is_safe,
            tide_level=tide_level,
            tide_uncertainty=tide_uncertainty,
            available_depth=available_depth,
            required_depth=required_depth,
            depth_margin=depth_margin,
            wind_speed=wind_speed,
            wind_gust=wind_gust,
            wind_limit=wind_limit,
            wind_margin=wind_margin,
            draft_check=draft_check,
            wind_check=wind_check,
            errors=errors,
            warnings=warnings,
        )

    def find_windows(
        self,
        start_time: datetime,
        end_time: datetime,
        ship: Ship,
        berth: Berth,
        tide_curve: TideCurve,
        wind_forecast: WindForecast,
        notes: Optional[List[ScheduleNote]] = None,
    ) -> List[BerthWindow]:
        """查找指定时间范围内的所有安全靠泊窗口。

        参数:
            start_time: 搜索起始时间
            end_time: 搜索结束时间
            ship: 船舶信息
            berth: 泊位信息
            tide_curve: 潮位曲线
            wind_forecast: 风速预报
            notes: 调度备注列表

        返回:
            按时间排序的靠泊窗口列表

        算法:
            1. 按时间步长遍历所有时间点
            2. 对每个时间点进行安全校验
            3. 将连续安全的时间点合并为窗口
            4. 过滤掉时长不足的窗口
        """
        if start_time >= end_time:
            raise ValueError("起始时间必须早于结束时间")

        # 确保时间带时区
        if start_time.tzinfo is None:
            start_time = start_time.replace(tzinfo=pytz.UTC)
        if end_time.tzinfo is None:
            end_time = end_time.replace(tzinfo=pytz.UTC)

        step = timedelta(minutes=self.threshold.time_step_minutes)
        min_window_duration = timedelta(minutes=self.threshold.min_window_minutes)

        all_results: List[SafetyCheckResult] = []
        current_time = start_time

        while current_time <= end_time:
            result = self.check_point(current_time, ship, berth, tide_curve, wind_forecast, notes)
            all_results.append(result)
            current_time += step

        # 合并连续的安全窗口
        windows: List[BerthWindow] = []
        current_window_results: List[SafetyCheckResult] = []
        window_counter = 0

        for result in all_results:
            if result.is_safe:
                current_window_results.append(result)
            else:
                if len(current_window_results) >= 2:
                    window_start = current_window_results[0].time
                    window_end = current_window_results[-1].time
                    duration = (window_end - window_start).total_seconds() / 60 + self.threshold.time_step_minutes

                    if duration >= self.threshold.min_window_minutes:
                        window_counter += 1
                        confidence = self._calculate_window_confidence(current_window_results)
                        window_notes = self._get_effective_notes(notes, window_start, window_end, ship, berth)

                        windows.append(BerthWindow(
                            window_id=f"WIN-{ship.imo or ship.name}-{berth.berth_id}-{window_counter:03d}",
                            ship=ship,
                            berth=berth,
                            start_time=window_start,
                            end_time=window_end + timedelta(minutes=self.threshold.time_step_minutes),
                            duration_minutes=int(duration),
                            check_results=current_window_results.copy(),
                            notes=window_notes,
                            confidence=confidence,
                        ))

                current_window_results = []

        # 处理循环结束后仍在进行的窗口
        if len(current_window_results) >= 2:
            window_start = current_window_results[0].time
            window_end = current_window_results[-1].time
            duration = (window_end - window_start).total_seconds() / 60 + self.threshold.time_step_minutes

            if duration >= self.threshold.min_window_minutes:
                window_counter += 1
                confidence = self._calculate_window_confidence(current_window_results)
                window_notes = self._get_effective_notes(notes, window_start, window_end, ship, berth)

                windows.append(BerthWindow(
                    window_id=f"WIN-{ship.imo or ship.name}-{berth.berth_id}-{window_counter:03d}",
                    ship=ship,
                    berth=berth,
                    start_time=window_start,
                    end_time=window_end + timedelta(minutes=self.threshold.time_step_minutes),
                    duration_minutes=int(duration),
                    check_results=current_window_results.copy(),
                    notes=window_notes,
                    confidence=confidence,
                ))

        return windows

    def _calculate_window_confidence(self, results: List[SafetyCheckResult]) -> float:
        """计算窗口的置信度。

        基于不确定度和余量计算：
        - 潮位不确定度越低，置信度越高
        - 水深余量越大，置信度越高
        - 风速余量越大，置信度越高
        """
        if not results:
            return 0.0

        tide_uncertainty_factor = max(0.0, 1.0 - max(r.tide_uncertainty for r in results) / 1.0)

        min_depth_margin = min(r.depth_margin for r in results)
        depth_factor = min(1.0, max(0.0, 0.5 + min_depth_margin / 1.0))

        min_wind_margin = min(r.wind_margin for r in results)
        wind_factor = min(1.0, max(0.0, 0.5 + min_wind_margin / 10.0))

        return round((tide_uncertainty_factor * 0.4 + depth_factor * 0.3 + wind_factor * 0.3), 2)

    def _get_effective_notes(
        self,
        notes: Optional[List[ScheduleNote]],
        start: datetime,
        end: datetime,
        ship: Ship,
        berth: Berth,
    ) -> List[ScheduleNote]:
        """获取窗口期间生效的调度备注。"""
        if not notes:
            return []

        effective = []
        for note in notes:
            if note.effective_from and note.effective_from > end:
                continue
            if note.effective_to and note.effective_to < start:
                continue
            if note.related_ship and note.related_ship != ship.imo and note.related_ship != ship.name:
                continue
            if note.related_berth and note.related_berth != berth.berth_id:
                continue
            effective.append(note)

        return sorted(effective, key=lambda n: -n.priority)

    def batch_find_windows(
        self,
        jobs: List[Tuple[datetime, datetime, Ship, Berth, TideCurve, WindForecast, Optional[List[ScheduleNote]]]],
    ) -> List[BerthWindow]:
        """批量查找靠泊窗口。

        参数:
            jobs: 作业列表，每个元素为 (start_time, end_time, ship, berth, tide_curve, wind_forecast, notes)

        返回:
            所有靠泊窗口的合并列表

        一致性保证:
            - 所有作业使用相同的阈值配置
            - 窗口ID生成规则一致
            - 结果按开始时间排序
        """
        all_windows = []

        for start_time, end_time, ship, berth, tide_curve, wind_forecast, notes in jobs:
            try:
                windows = self.find_windows(start_time, end_time, ship, berth, tide_curve, wind_forecast, notes)
                all_windows.extend(windows)
            except Exception as e:
                # 捕获单条作业的异常，不影响其他作业
                from .exceptions import TideBerthException
                if not isinstance(e, TideBerthException):
                    raise TideBerthException(
                        f"批量处理作业时出错: {str(e)}",
                        source_file=getattr(ship.version, 'source_file', 'unknown'),
                        object_id=f"ship={ship.imo or ship.name}, berth={berth.berth_id}",
                        details={"error_type": type(e).__name__},
                    ) from e
                raise

        # 按开始时间排序
        all_windows.sort(key=lambda w: w.start_time)

        # 检测冲突（同一泊位同一时间被多条船舶占用）
        self._detect_conflicts(all_windows)

        return all_windows

    def _detect_conflicts(self, windows: List[BerthWindow]) -> None:
        """检测窗口冲突。

        同一泊位在同一时间只能安排一艘船舶靠泊。
        冲突信息记录在窗口的notes中。
        """
        # 按泊位分组
        berth_windows: dict = {}
        for window in windows:
            key = window.berth.berth_id
            if key not in berth_windows:
                berth_windows[key] = []
            berth_windows[key].append(window)

        # 检测每个泊位的时间重叠
        for berth_id, berth_win_list in berth_windows.items():
            berth_win_list.sort(key=lambda w: w.start_time)
            for i in range(len(berth_win_list)):
                for j in range(i + 1, len(berth_win_list)):
                    w1, w2 = berth_win_list[i], berth_win_list[j]
                    if w2.start_time < w1.end_time:
                        # 检测到冲突
                        conflict_note = ScheduleNote(
                            version=w1.check_results[0].time,  # placeholder
                            time=w1.start_time,
                            content=f"⚠️ 调度冲突: 与窗口 {w2.window_id} ({w2.ship.name}) 时间重叠",
                            priority=2,
                            related_ship=w1.ship.imo,
                            related_berth=berth_id,
                            effective_from=w1.start_time,
                            effective_to=w1.end_time,
                        )
                        w1.notes.append(conflict_note)

                        conflict_note2 = ScheduleNote(
                            version=w2.check_results[0].time,  # placeholder
                            time=w2.start_time,
                            content=f"⚠️ 调度冲突: 与窗口 {w1.window_id} ({w1.ship.name}) 时间重叠",
                            priority=2,
                            related_ship=w2.ship.imo,
                            related_berth=berth_id,
                            effective_from=w2.start_time,
                            effective_to=w2.end_time,
                        )
                        w2.notes.append(conflict_note2)
                    else:
                        break  # 后续窗口开始时间更晚，无需继续检查

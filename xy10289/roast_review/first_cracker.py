from __future__ import annotations

from typing import Dict, List, Optional, Tuple

from .models import FirstCrackInfo, FirstCrackType, RoastBatch, TemperaturePoint


class FirstCrackDetector:
    """一爆检测器"""

    MIN_FIRST_CRACK_TEMP = 185.0
    MAX_FIRST_CRACK_TEMP = 220.0
    NORMAL_RATIO_MIN = 0.55
    NORMAL_RATIO_MAX = 0.75
    EARLY_RATIO_THRESHOLD = 0.50
    LATE_RATIO_THRESHOLD = 0.80

    def __init__(self):
        self.warnings: List[str] = []

    def detect_auto(self, batch: RoastBatch) -> Optional[FirstCrackInfo]:
        """自动检测一爆时间点"""
        self.warnings = []

        if not batch.curve_points:
            self.warnings.append("无法检测一爆：没有温度曲线数据")
            return None

        sorted_points = sorted(batch.curve_points, key=lambda p: p.time_seconds)

        if len(sorted_points) < 10:
            self.warnings.append("温度曲线数据点过少，一爆检测可能不准确")

        candidate_time, candidate_temp, confidence = self._find_first_crack_candidate(
            sorted_points
        )

        if candidate_time is None:
            self.warnings.append("未能自动检测到一爆点，请手动标记")
            return None

        crack_type = self._classify_crack_type(candidate_time, batch)

        return FirstCrackInfo(
            start_time_seconds=candidate_time,
            start_temp=candidate_temp,
            crack_type=crack_type,
            notes=f"自动检测，置信度: {confidence:.1%}",
        )

    def mark_manual(
        self,
        batch: RoastBatch,
        start_time_seconds: float,
        start_temp: Optional[float] = None,
        end_time_seconds: Optional[float] = None,
        end_temp: Optional[float] = None,
        intensity: str = "medium",
        notes: Optional[str] = None,
    ) -> RoastBatch:
        """手动标记一爆点"""
        if start_temp is None:
            start_temp = self._get_temp_at_time(batch, start_time_seconds)

        if start_temp is None:
            raise ValueError(f"无法在时间 {start_time_seconds}s 处找到温度数据")

        if start_temp < self.MIN_FIRST_CRACK_TEMP or start_temp > self.MAX_FIRST_CRACK_TEMP:
            raise ValueError(
                f"一爆起始温度异常: {start_temp}°C。"
                f"正常范围: {self.MIN_FIRST_CRACK_TEMP}-{self.MAX_FIRST_CRACK_TEMP}°C"
            )

        if end_time_seconds is not None and end_temp is None:
            end_temp = self._get_temp_at_time(batch, end_time_seconds)

        if end_time_seconds is not None and end_time_seconds <= start_time_seconds:
            raise ValueError("一爆结束时间必须晚于开始时间")

        crack_type = self._classify_crack_type(start_time_seconds, batch)

        first_crack = FirstCrackInfo(
            start_time_seconds=start_time_seconds,
            start_temp=start_temp,
            end_time_seconds=end_time_seconds,
            end_temp=end_temp,
            intensity=intensity,
            crack_type=crack_type,
            notes=notes,
        )

        return batch.model_copy(update={"first_crack": first_crack})

    def validate_existing(self, batch: RoastBatch) -> List[str]:
        """验证现有的一爆标记"""
        issues: List[str] = []

        if not batch.first_crack:
            issues.append("批次没有一爆标记")
            return issues

        fc = batch.first_crack

        if fc.start_temp < self.MIN_FIRST_CRACK_TEMP:
            issues.append(
                f"一爆起始温度偏低: {fc.start_temp}°C "
                f"(最低建议: {self.MIN_FIRST_CRACK_TEMP}°C)"
            )

        if fc.start_temp > self.MAX_FIRST_CRACK_TEMP:
            issues.append(
                f"一爆起始温度偏高: {fc.start_temp}°C "
                f"(最高建议: {self.MAX_FIRST_CRACK_TEMP}°C)"
            )

        if batch.total_roast_time_seconds:
            ratio = fc.start_time_seconds / batch.total_roast_time_seconds

            if ratio < self.EARLY_RATIO_THRESHOLD:
                issues.append(
                    f"一爆发生过早: 占总烘焙时间的 {ratio:.1%} "
                    f"(建议: {self.NORMAL_RATIO_MIN:.0%}-{self.NORMAL_RATIO_MAX:.0%})"
                )
            elif ratio > self.LATE_RATIO_THRESHOLD:
                issues.append(
                    f"一爆发生过晚: 占总烘焙时间的 {ratio:.1%} "
                    f"(建议: {self.NORMAL_RATIO_MIN:.0%}-{self.NORMAL_RATIO_MAX:.0%})"
                )

        if fc.end_time_seconds and fc.duration_seconds:
            if fc.duration_seconds < 30:
                issues.append(f"一爆持续时间较短: {fc.duration_seconds}s")
            elif fc.duration_seconds > 180:
                issues.append(f"一爆持续时间较长: {fc.duration_seconds}s")

        return issues

    def _find_first_crack_candidate(
        self, points: List[TemperaturePoint]
    ) -> Tuple[Optional[float], Optional[float], float]:
        """寻找一爆候选点"""
        candidate_time = None
        candidate_temp = None
        confidence = 0.0

        temps = [p.bean_temp for p in points]
        times = [p.time_seconds for p in points]

        for i in range(3, len(points) - 3):
            temp = temps[i]

            if temp < self.MIN_FIRST_CRACK_TEMP or temp > self.MAX_FIRST_CRACK_TEMP:
                continue

            rate_before = self._calculate_rate(temps, times, max(0, i - 5), i)
            rate_after = self._calculate_rate(temps, times, i, min(len(points) - 1, i + 5))

            if rate_before > 0.15 and rate_after is not None and rate_after < rate_before * 0.7:
                candidate_time = times[i]
                candidate_temp = temp
                confidence = min(0.85, 0.5 + rate_before * 0.5)
                break

        if candidate_time is None:
            for i, point in enumerate(points):
                if self.MIN_FIRST_CRACK_TEMP <= point.bean_temp <= self.MAX_FIRST_CRACK_TEMP:
                    candidate_time = point.time_seconds
                    candidate_temp = point.bean_temp
                    confidence = 0.4
                    break

        return candidate_time, candidate_temp, confidence

    @staticmethod
    def _calculate_rate(
        temps: List[float], times: List[float], start_idx: int, end_idx: int
    ) -> Optional[float]:
        """计算升温速率"""
        if end_idx <= start_idx:
            return None

        delta_temp = temps[end_idx] - temps[start_idx]
        delta_time = times[end_idx] - times[start_idx]

        if delta_time <= 0:
            return None

        return delta_temp / delta_time

    @staticmethod
    def _get_temp_at_time(batch: RoastBatch, time_seconds: float) -> Optional[float]:
        """获取指定时间点的温度（线性插值）"""
        if not batch.curve_points:
            return None

        sorted_points = sorted(batch.curve_points, key=lambda p: p.time_seconds)

        if time_seconds <= sorted_points[0].time_seconds:
            return sorted_points[0].bean_temp

        if time_seconds >= sorted_points[-1].time_seconds:
            return sorted_points[-1].bean_temp

        for i in range(len(sorted_points) - 1):
            p1 = sorted_points[i]
            p2 = sorted_points[i + 1]

            if p1.time_seconds <= time_seconds <= p2.time_seconds:
                if p2.time_seconds == p1.time_seconds:
                    return p1.bean_temp

                ratio = (time_seconds - p1.time_seconds) / (p2.time_seconds - p1.time_seconds)
                return p1.bean_temp + ratio * (p2.bean_temp - p1.bean_temp)

        return None

    def _classify_crack_type(self, start_time: float, batch: RoastBatch) -> FirstCrackType:
        """根据时间比例分类一爆类型"""
        if not batch.total_roast_time_seconds or batch.total_roast_time_seconds == 0:
            return FirstCrackType.NORMAL

        ratio = start_time / batch.total_roast_time_seconds

        if ratio < self.EARLY_RATIO_THRESHOLD:
            return FirstCrackType.EARLY
        elif ratio > self.LATE_RATIO_THRESHOLD:
            return FirstCrackType.LATE
        else:
            return FirstCrackType.NORMAL

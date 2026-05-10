from __future__ import annotations

from typing import Dict, List, Optional, Tuple

from .models import HeatingRateProfile, RoastBatch, TemperaturePoint


class HeatingRateCalculator:
    """升温率计算器"""

    MAX_NORMAL_RATE = 1.0
    MIN_NORMAL_RATE = 0.05
    STALL_THRESHOLD = -0.1
    RISING_TOO_FAST_THRESHOLD = 1.5

    def calculate(self, batch: RoastBatch, window_seconds: float = 30.0) -> HeatingRateProfile:
        """计算升温率剖面"""
        if not batch.curve_points:
            return HeatingRateProfile(
                batch_id=batch.batch_id,
                anomalies=["没有温度曲线数据"],
            )

        sorted_points = sorted(batch.curve_points, key=lambda p: p.time_seconds)

        rate_points = self._calculate_rate_points(sorted_points, window_seconds)

        if not rate_points:
            return HeatingRateProfile(
                batch_id=batch.batch_id,
                anomalies=["无法计算升温率，数据点不足"],
            )

        profile = HeatingRateProfile(
            batch_id=batch.batch_id,
            rate_points=rate_points,
        )

        if batch.first_crack:
            fc_time = batch.first_crack.start_time_seconds
            profile.avg_rate_0_to_first_crack = self._avg_rate_in_range(
                rate_points, 0, fc_time
            )
            profile.avg_rate_first_crack_to_drop = self._avg_rate_in_range(
                rate_points, fc_time, sorted_points[-1].time_seconds
            )

        rates = [p["rate"] for p in rate_points]
        if rates:
            profile.peak_rate = max(rates)
            peak_idx = rates.index(profile.peak_rate)
            profile.peak_rate_time = rate_points[peak_idx]["time_seconds"]
            profile.min_rate = min(rates)

        profile.anomalies = self._detect_anomalies(profile, sorted_points, batch)

        return profile

    def _calculate_rate_points(
        self, points: List[TemperaturePoint], window_seconds: float
    ) -> List[Dict[str, float]]:
        """计算每个时间点的升温率"""
        rate_points: List[Dict[str, float]] = []

        for i, point in enumerate(points):
            window_start = point.time_seconds - window_seconds / 2
            window_end = point.time_seconds + window_seconds / 2

            window_points = [
                p for p in points if window_start <= p.time_seconds <= window_end
            ]

            if len(window_points) < 2:
                continue

            start_p = window_points[0]
            end_p = window_points[-1]

            delta_time = end_p.time_seconds - start_p.time_seconds
            delta_temp = end_p.bean_temp - start_p.bean_temp

            if delta_time > 0:
                rate = delta_temp / delta_time
                rate_points.append({
                    "time_seconds": point.time_seconds,
                    "rate": round(rate, 4),
                    "temp": point.bean_temp,
                })

        return rate_points

    @staticmethod
    def _avg_rate_in_range(
        rate_points: List[Dict[str, float]],
        start_time: float,
        end_time: float,
    ) -> Optional[float]:
        """计算指定时间范围内的平均升温率"""
        in_range = [
            p["rate"]
            for p in rate_points
            if start_time <= p["time_seconds"] <= end_time
        ]

        if not in_range:
            return None

        return round(sum(in_range) / len(in_range), 4)

    def _detect_anomalies(
        self,
        profile: HeatingRateProfile,
        points: List[TemperaturePoint],
        batch: RoastBatch,
    ) -> List[str]:
        """检测升温率异常"""
        anomalies: List[str] = []

        if profile.peak_rate and profile.peak_rate > self.RISING_TOO_FAST_THRESHOLD:
            anomalies.append(
                f"升温过快: 峰值升温率 {profile.peak_rate:.3f}°C/s "
                f"出现在 {self._format_time(profile.peak_rate_time)}，"
                f"超过建议阈值 {self.RISING_TOO_FAST_THRESHOLD}°C/s"
            )

        if profile.min_rate and profile.min_rate < self.STALL_THRESHOLD:
            anomalies.append(
                f"温度停滞/下降: 最低升温率 {profile.min_rate:.3f}°C/s，"
                f"低于停滞阈值 {self.STALL_THRESHOLD}°C/s"
            )

        if profile.avg_rate_0_to_first_crack is not None:
            if profile.avg_rate_0_to_first_crack < self.MIN_NORMAL_RATE:
                anomalies.append(
                    f"一爆前升温过慢: 平均 {profile.avg_rate_0_to_first_crack:.3f}°C/s"
                )
            elif profile.avg_rate_0_to_first_crack > self.MAX_NORMAL_RATE:
                anomalies.append(
                    f"一爆前升温过快: 平均 {profile.avg_rate_0_to_first_crack:.3f}°C/s"
                )

        if profile.avg_rate_first_crack_to_drop is not None:
            if profile.avg_rate_first_crack_to_drop > 0.5:
                anomalies.append(
                    f"一爆后升温过快: 平均 {profile.avg_rate_first_crack_to_drop:.3f}°C/s，"
                    "建议一爆后减缓升温"
                )
            elif profile.avg_rate_first_crack_to_drop < -0.1:
                anomalies.append(
                    f"一爆后温度下降: 平均 {profile.avg_rate_first_crack_to_drop:.3f}°C/s"
                )

        for i in range(1, len(profile.rate_points)):
            prev = profile.rate_points[i - 1]
            curr = profile.rate_points[i]

            rate_change = curr["rate"] - prev["rate"]
            if abs(rate_change) > 0.5:
                time_str = self._format_time(curr["time_seconds"])
                anomalies.append(
                    f"升温率突变: 在 {time_str} 处变化了 {rate_change:+.3f}°C/s"
                )

        return anomalies

    @staticmethod
    def _format_time(seconds: Optional[float]) -> str:
        """格式化时间显示"""
        if seconds is None:
            return "--:--"

        minutes = int(seconds // 60)
        secs = int(seconds % 60)
        return f"{minutes:02d}:{secs:02d}"

    def compare_rates(
        self, profiles: List[HeatingRateProfile]
    ) -> List[Dict[str, any]]:
        """比较多个批次的升温率"""
        if not profiles:
            return []

        comparison: List[Dict[str, any]] = []

        for profile in profiles:
            comparison.append({
                "batch_id": profile.batch_id,
                "peak_rate": profile.peak_rate,
                "peak_rate_time": profile.peak_rate_time,
                "avg_before_fc": profile.avg_rate_0_to_first_crack,
                "avg_after_fc": profile.avg_rate_first_crack_to_drop,
                "anomaly_count": len(profile.anomalies),
            })

        return comparison

from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, field
from datetime import datetime
import json
import math
from collections import defaultdict


@dataclass
class VibrationPoint:
    time: datetime
    x: float
    y: float
    z: float
    overall: float


@dataclass
class VibrationTrend:
    parameter: str
    values: List[float]
    times: List[datetime]
    trend_direction: str
    trend_rate: float
    peak_value: float
    peak_time: Optional[datetime]
    avg_value: float
    std_dev: float


@dataclass
class VibrationAnalysisResult:
    overall_trend: VibrationTrend
    x_trend: VibrationTrend
    y_trend: VibrationTrend
    z_trend: VibrationTrend
    abnormal_points: List[Tuple[datetime, str, float]]
    frequency_components: Dict[str, float]
    diagnosis: str
    possible_causes: List[str]
    recommendations: List[str]
    raw_data_snapshot: str = field(default="")


class VibrationAnalyzer:
    def __init__(self):
        self.bearing_fault_freqs = {
            "BPFO": 0.4,
            "BPFI": 0.6,
            "FTF": 0.39,
            "BSF": 0.2,
        }

    def analyze(self, records: List) -> VibrationAnalysisResult:
        if not records:
            return self._empty_result()

        points = [
            VibrationPoint(
                time=r.record_time,
                x=r.x_vibration or 0,
                y=r.y_vibration or 0,
                z=r.z_vibration or 0,
                overall=r.overall_vibration or 0,
            )
            for r in sorted(records, key=lambda x: x.record_time)
        ]

        raw_snapshot = self._create_data_snapshot(points)

        x_values = [p.x for p in points]
        y_values = [p.y for p in points]
        z_values = [p.z for p in points]
        overall_values = [p.overall for p in points]
        times = [p.time for p in points]

        x_trend = self._calc_trend("x_vibration", x_values, times)
        y_trend = self._calc_trend("y_vibration", y_values, times)
        z_trend = self._calc_trend("z_vibration", z_values, times)
        overall_trend = self._calc_trend("overall_vibration", overall_values, times)

        abnormal_points = self._find_abnormal_points(points)
        frequency_components = self._analyze_frequency(overall_values)
        diagnosis, possible_causes, recommendations = self._generate_diagnosis(
            overall_trend, x_trend, y_trend, z_trend, abnormal_points, frequency_components
        )

        return VibrationAnalysisResult(
            overall_trend=overall_trend,
            x_trend=x_trend,
            y_trend=y_trend,
            z_trend=z_trend,
            abnormal_points=abnormal_points,
            frequency_components=frequency_components,
            diagnosis=diagnosis,
            possible_causes=possible_causes,
            recommendations=recommendations,
            raw_data_snapshot=raw_snapshot,
        )

    def _create_data_snapshot(self, points: List[VibrationPoint]) -> str:
        if not points:
            return ""

        snapshot = {
            "data_version": "1.0",
            "snapshot_time": datetime.now().isoformat(),
            "record_count": len(points),
            "time_range": {
                "start": points[0].time.isoformat(),
                "end": points[-1].time.isoformat(),
            },
            "sample_points": [
                {
                    "t": p.time.isoformat(),
                    "x": round(p.x, 4),
                    "y": round(p.y, 4),
                    "z": round(p.z, 4),
                    "o": round(p.overall, 4),
                }
                for p in points[::max(1, len(points) // 100)]
            ],
            "statistics": {
                "x_avg": round(sum(p.x for p in points) / len(points), 4),
                "y_avg": round(sum(p.y for p in points) / len(points), 4),
                "z_avg": round(sum(p.z for p in points) / len(points), 4),
                "o_avg": round(sum(p.overall for p in points) / len(points), 4),
                "o_max": round(max(p.overall for p in points), 4),
            },
        }
        return json.dumps(snapshot, ensure_ascii=False)

    def _calc_trend(self, param: str, values: List[float], times: List[datetime]) -> VibrationTrend:
        if not values:
            return VibrationTrend(param, [], [], "stable", 0, 0, None, 0, 0)

        n = len(values)
        avg = sum(values) / n
        variance = sum((v - avg) ** 2 for v in values) / n
        std_dev = math.sqrt(variance)

        if n >= 2:
            time_diffs = [(times[i] - times[0]).total_seconds() / 3600 for i in range(n)]
            avg_time = sum(time_diffs) / n
            numerator = sum((time_diffs[i] - avg_time) * (values[i] - avg) for i in range(n))
            denominator = sum((t - avg_time) ** 2 for t in time_diffs)
            if denominator > 0:
                slope = numerator / denominator
            else:
                slope = 0

            if abs(slope) < 0.01:
                direction = "stable"
            elif slope > 0:
                direction = "rising"
            else:
                direction = "falling"
            trend_rate = slope
        else:
            direction = "stable"
            trend_rate = 0

        peak_idx = values.index(max(values))

        return VibrationTrend(
            parameter=param,
            values=values,
            times=times,
            trend_direction=direction,
            trend_rate=trend_rate,
            peak_value=values[peak_idx],
            peak_time=times[peak_idx] if peak_idx < len(times) else None,
            avg_value=avg,
            std_dev=std_dev,
        )

    def _find_abnormal_points(self, points: List[VibrationPoint]) -> List[Tuple[datetime, str, float]]:
        abnormal = []
        thresholds = {"x": 2.8, "y": 2.8, "z": 2.8, "overall": 4.5}

        for p in points:
            if p.overall > thresholds["overall"]:
                abnormal.append((p.time, "overall", p.overall))
            elif p.x > thresholds["x"]:
                abnormal.append((p.time, "x", p.x))
            elif p.y > thresholds["y"]:
                abnormal.append((p.time, "y", p.y))
            elif p.z > thresholds["z"]:
                abnormal.append((p.time, "z", p.z))

        return abnormal

    def _analyze_frequency(self, values: List[float]) -> Dict[str, float]:
        if len(values) < 4:
            return {}

        components = {}
        n = len(values)
        avg = sum(values) / n

        for k in range(1, min(n // 2, 10)):
            real = sum(values[i] * math.cos(2 * math.pi * k * i / n) for i in range(n))
            imag = sum(values[i] * math.sin(2 * math.pi * k * i / n) for i in range(n))
            magnitude = 2 * math.sqrt(real ** 2 + imag ** 2) / n
            if magnitude > 0.1:
                components[f"f{k}"] = round(magnitude, 4)

        return components

    def _generate_diagnosis(
        self,
        overall_trend: VibrationTrend,
        x_trend: VibrationTrend,
        y_trend: VibrationTrend,
        z_trend: VibrationTrend,
        abnormal_points: List,
        freq_components: Dict,
    ) -> Tuple[str, List[str], List[str]]:

        max_vibration = overall_trend.peak_value
        avg_vibration = overall_trend.avg_value

        if max_vibration >= 7.1:
            severity = "严重"
        elif max_vibration >= 4.5:
            severity = "警告"
        elif max_vibration >= 2.8:
            severity = "注意"
        else:
            severity = "正常"

        diagnosis = f"振动状态{severity}。"
        diagnosis += f"平均振动{avg_vibration:.2f}mm/s，"
        diagnosis += f"峰值{max_vibration:.2f}mm/s，"
        diagnosis += f"趋势{self._trend_desc(overall_trend.trend_direction)}。"

        if abnormal_points:
            diagnosis += f"共发现{len(abnormal_points)}个异常点。"

        possible_causes = []
        recommendations = []

        if max_vibration >= 4.5:
            if x_trend.peak_value > y_trend.peak_value and x_trend.peak_value > z_trend.peak_value:
                possible_causes.append("水平方向振动突出，可能存在不对中或轴承磨损")
                recommendations.append("检查电机与主机对中情况")
                recommendations.append("检测驱动端轴承磨损情况")
            elif y_trend.peak_value > x_trend.peak_value and y_trend.peak_value > z_trend.peak_value:
                possible_causes.append("垂直方向振动突出，可能存在基础松动或结构共振")
                recommendations.append("检查基础螺栓紧固情况")
                recommendations.append("检测设备基础是否存在松动")
            else:
                possible_causes.append("轴向振动突出，可能存在联轴器磨损或轴向窜动")
                recommendations.append("检查联轴器磨损情况")
                recommendations.append("检测轴向窜动间隙")

            possible_causes.append("转子不平衡")
            possible_causes.append("齿轮啮合故障")
            recommendations.append("做动平衡校正")
            recommendations.append("检查齿轮箱啮合情况")

        if overall_trend.trend_direction == "rising" and overall_trend.trend_rate > 0.05:
            possible_causes.append("振动呈上升趋势，说明故障在发展中")
            recommendations.append("缩短监测周期，密切关注振动变化")

        if overall_trend.std_dev > 1.0:
            possible_causes.append("振动波动大，可能存在间歇性故障")
            recommendations.append("排查载荷波动情况")
            recommendations.append("检查是否存在间歇性摩擦")

        if not possible_causes:
            possible_causes.append("振动状态良好")

        if not recommendations:
            recommendations.append("按正常周期巡检")

        return diagnosis, possible_causes, recommendations

    def _trend_desc(self, direction: str) -> str:
        return {"stable": "平稳", "rising": "上升", "falling": "下降"}.get(direction, "平稳")

    def _empty_result(self) -> VibrationAnalysisResult:
        empty_trend = VibrationTrend("", [], [], "stable", 0, 0, None, 0, 0)
        return VibrationAnalysisResult(
            overall_trend=empty_trend,
            x_trend=empty_trend,
            y_trend=empty_trend,
            z_trend=empty_trend,
            abnormal_points=[],
            frequency_components={},
            diagnosis="无振动数据",
            possible_causes=[],
            recommendations=["请检查数据导入是否正确"],
        )


vibration_analyzer = VibrationAnalyzer()

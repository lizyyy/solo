"""
运动学分析模块
====================

核心公式：
1. 速度 v = Δx / Δt  (单位: m/s)
2. 划水频率 f = 划水次数 / 时间 (单位: Hz, 或 次/分钟)
3. 划水步幅 SL = 速度 / 频率 (单位: m/次)
4. 加速度 a = Δv / Δt (单位: m/s²)

边界输入：
- 采样间隔 Δt：由设备决定，通常 0.01s ~ 0.1s
- 池长 L：标准池 25m 或 50m，需人工确认
- 泳姿：自由泳、蛙泳、仰泳、蝶泳，影响阻力系数
"""

from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple
import math


@dataclass
class KinematicInput:
    """运动学输入数据结构
    单位：
    - time: 秒 (s)
    - position: 米 (m)
    - stroke_count: 累计划水次数 (次)
    """
    time: List[float]
    position: List[float]
    stroke_count: List[int]
    pool_length: float
    stroke_style: str
    athlete_name: str
    sample_rate: float  # Hz

    def validate(self) -> List[str]:
        """验证输入数据，返回错误列表"""
        errors = []
        n = len(self.time)
        if len(self.position) != n:
            errors.append(f"position长度({len(self.position)})与time长度({n})不一致")
        if len(self.stroke_count) != n:
            errors.append(f"stroke_count长度({len(self.stroke_count)})与time长度({n})不一致")
        if n < 2:
            errors.append("数据点不足，至少需要2个采样点")
        if self.pool_length <= 0:
            errors.append(f"池长必须>0，当前值: {self.pool_length}m")
        if self.sample_rate <= 0:
            errors.append(f"采样率必须>0，当前值: {self.sample_rate}Hz")
        if self.stroke_style not in ["自由泳", "蛙泳", "仰泳", "蝶泳"]:
            errors.append(f"未知泳姿: {self.stroke_style}，应为: 自由泳/蛙泳/仰泳/蝶泳")
        for i in range(1, n):
            if self.time[i] <= self.time[i-1]:
                errors.append(f"时间序列非递增，索引{i}: {self.time[i-1]} -> {self.time[i]}")
            if self.stroke_count[i] < self.stroke_count[i-1]:
                errors.append(f"划水次数非递增，索引{i}: {self.stroke_count[i-1]} -> {self.stroke_count[i]}")
        return errors


@dataclass
class KinematicPoint:
    """单个采样点的运动学数据"""
    idx: int
    time: float
    position: float
    velocity: float
    acceleration: float
    stroke_count: int
    stroke_rate: float  # 瞬时划水频率 (次/分钟)
    stroke_length: float  # 划水步幅 (m/次)


@dataclass
class KinematicResult:
    """运动学分析结果，包含所有中间量和证据链"""
    points: List[KinematicPoint] = field(default_factory=list)
    stats: Dict = field(default_factory=dict)
    raw_input: Optional[KinematicInput] = None
    warnings: List[str] = field(default_factory=list)
    evidence: Dict = field(default_factory=dict)


def analyze_kinematics(data: KinematicInput) -> KinematicResult:
    """
    运动学主分析函数
    
    计算步骤：
    1. 验证输入数据
    2. 计算速度 v = Δx / Δt
    3. 计算加速度 a = Δv / Δt
    4. 计算划水频率 f = Δstroke / Δt
    5. 计算划水步幅 SL = v / f
    6. 统计各段均值、极值
    """
    result = KinematicResult(raw_input=data)
    result.evidence["input_validation"] = {"pool_length": data.pool_length,
                                            "stroke_style": data.stroke_style,
                                            "sample_rate": data.sample_rate,
                                            "total_points": len(data.time)}

    errors = data.validate()
    if errors:
        result.warnings.extend([f"输入错误: {e}" for e in errors])
        return result

    n = len(data.time)
    dt_expected = 1.0 / data.sample_rate

    for i in range(n):
        if i == 0:
            v = 0.0
            a = 0.0
            stroke_rate = 0.0
            stroke_length = 0.0
        else:
            dt = data.time[i] - data.time[i-1]
            dx = data.position[i] - data.position[i-1]
            v = dx / dt if dt > 0 else 0.0

            if abs(dt - dt_expected) > dt_expected * 0.5:
                result.warnings.append(
                    f"时间{i}: 采样间隔异常 dt={dt:.4f}s (预期{dt_expected:.4f}s)"
                )
                result.evidence.setdefault("dt_anomalies", []).append({
                    "idx": i, "dt": dt, "expected": dt_expected
                })

            if i == 1:
                a = v / dt if dt > 0 else 0.0
            else:
                v_prev = result.points[i-1].velocity
                a = (v - v_prev) / dt if dt > 0 else 0.0

            d_stroke = data.stroke_count[i] - data.stroke_count[i-1]

            window_size = min(i, int(3.0 / dt_expected))  # 3秒滑动窗口
            if window_size >= 1:
                window_start = i - window_size
                window_strokes = data.stroke_count[i] - data.stroke_count[window_start]
                window_time = data.time[i] - data.time[window_start]
                stroke_rate = (window_strokes / window_time) * 60.0 if window_time > 0 else 0.0
            else:
                stroke_rate = (d_stroke / dt) * 60.0 if dt > 0 else 0.0

            avg_stroke_rate_for_sl = stroke_rate if stroke_rate > 0 else 0.0
            if avg_stroke_rate_for_sl > 0:
                stroke_length = v / (avg_stroke_rate_for_sl / 60.0)
            elif d_stroke > 0:
                stroke_length = dx / d_stroke
            else:
                stroke_length = 0.0

        point = KinematicPoint(
            idx=i,
            time=data.time[i],
            position=data.position[i],
            velocity=v,
            acceleration=a,
            stroke_count=data.stroke_count[i],
            stroke_rate=stroke_rate,
            stroke_length=stroke_length
        )
        result.points.append(point)

    velocities = [p.velocity for p in result.points]
    accelerations = [p.acceleration for p in result.points]
    stroke_rates = [p.stroke_rate for p in result.points if p.stroke_rate > 0]
    stroke_lengths = [p.stroke_length for p in result.points if p.stroke_length > 0]

    result.stats = {
        "total_time": data.time[-1] - data.time[0],
        "total_distance": data.position[-1] - data.position[0],
        "total_strokes": data.stroke_count[-1] - data.stroke_count[0],
        "avg_velocity": sum(velocities) / len(velocities) if velocities else 0,
        "max_velocity": max(velocities) if velocities else 0,
        "min_velocity": min(velocities) if velocities else 0,
        "avg_acceleration": sum(accelerations) / len(accelerations) if accelerations else 0,
        "max_acceleration": max(accelerations) if accelerations else 0,
        "min_acceleration": min(accelerations) if accelerations else 0,
        "avg_stroke_rate": sum(stroke_rates) / len(stroke_rates) if stroke_rates else 0,
        "max_stroke_rate": max(stroke_rates) if stroke_rates else 0,
        "avg_stroke_length": sum(stroke_lengths) / len(stroke_lengths) if stroke_lengths else 0,
        "max_stroke_length": max(stroke_lengths) if stroke_lengths else 0,
    }

    result.evidence["velocity_extremes"] = {
        "max_at": velocities.index(result.stats["max_velocity"]),
        "min_at": velocities.index(result.stats["min_velocity"]),
    }

    return result

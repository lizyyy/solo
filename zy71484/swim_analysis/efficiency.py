"""
效率分析模块
====================

核心公式：
1. 划水效率 η_stroke = (v * SL) / (P / f)
   即：单位划水产生的推进距离 / 单位划水消耗的能量

2. 推进效率 η_propulsive = 有用功率 / 总功率
   有用功率 = D_passive * v
   总功率 = D_active * v
   η_propulsive = D_passive / D_active = 1 / K

3. 整体效率 η_overall = η_stroke * η_propulsive

4. 效率指数 EI = v * SL / (Cd * A)
   用于跨运动员对比，消除身体形态影响

边界输入：
- 有效划水比例：实际产生推进力的划水占比
- 滑行效率：每次划水后的滑行距离
"""

from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple
import math
from .kinematics import KinematicResult, KinematicPoint
from .resistance import ResistanceResult, ResistancePoint


@dataclass
class EfficiencyPoint:
    """单个采样点的效率数据"""
    idx: int
    time: float
    position: float
    velocity: float
    stroke_rate: float
    stroke_length: float
    stroke_efficiency: float      # 划水效率
    propulsive_efficiency: float  # 推进效率
    overall_efficiency: float     # 整体效率
    efficiency_index: float       # 效率指数（跨运动员对比用）
    work_per_stroke: float        # 每划水做功 (J)
    distance_per_work: float      # 单位能量前进距离 (m/J)


@dataclass
class EfficiencyResult:
    """效率分析结果"""
    points: List[EfficiencyPoint] = field(default_factory=list)
    stats: Dict = field(default_factory=dict)
    low_efficiency_segments: List[Dict] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    evidence: Dict = field(default_factory=dict)
    formulas: Dict = field(default_factory=dict)


def analyze_efficiency(
    kinematic_result: KinematicResult,
    resistance_result: ResistanceResult
) -> EfficiencyResult:
    """
    效率主分析函数

    计算步骤：
    1. 对齐运动学和阻力分析的时间点
    2. 逐点计算：
       - 每划水做功 W = P / f （功率除以频率）
       - 划水效率 η_stroke = (v * SL) / W
       - 推进效率 η_propulsive = 1 / K
       - 整体效率 η_overall = η_stroke * η_propulsive
       - 效率指数 EI = v * SL / (Cd * A)
    3. 识别低效率段落（效率低于平均值的 70%）
    4. 统计效率分布和趋势
    """
    result = EfficiencyResult()

    result.formulas = {
        "stroke_efficiency": "η_stroke = (v * SL) / (P / f)  ——  单位划水推进距离 / 单位划水能耗",
        "propulsive_efficiency": "η_propulsive = D_passive / D_active = 1 / K  ——  被动阻力 / 主动阻力",
        "overall_efficiency": "η_overall = η_stroke * η_propulsive  ——  划水效率 × 推进效率",
        "efficiency_index": "EI = (v * SL) / (Cd * A)  ——  消除身体形态影响的跨运动员对比指数",
        "work_per_stroke": "W = P / f  ——  功率 / 划水频率",
        "distance_per_work": "DPW = SL / W  ——  划水步幅 / 每划水做功"
    }

    k_points = kinematic_result.points
    r_points = resistance_result.points

    if len(k_points) != len(r_points):
        result.warnings.append(f"数据点数量不匹配: 运动学{len(k_points)} vs 阻力{len(r_points)}")
        return result

    if len(k_points) < 2:
        result.warnings.append("数据点不足，无法计算效率")
        return result

    K = resistance_result.params_used.get("K_active", 1.3)
    Cd = resistance_result.params_used.get("Cd", 0.45)
    A = resistance_result.params_used.get("frontal_area_A", 0.1)

    result.evidence["efficiency_params"] = {
        "K_active": K,
        "Cd": Cd,
        "frontal_area_A": A,
        "propulsive_efficiency_value": 1.0 / K
    }

    propulsive_eff = 1.0 / K

    for i, (kp, rp) in enumerate(zip(k_points, r_points)):
        v = kp.velocity
        SL = kp.stroke_length
        f = kp.stroke_rate / 60.0  # 转换为 Hz
        P = rp.propulsive_power

        if f > 0 and P > 0 and v > 0:
            W = P / f
            if W > 0:
                stroke_eff = (v * SL) / W
            else:
                stroke_eff = 0.0
            dpw = SL / W if W > 0 else 0.0
        else:
            W = 0.0
            stroke_eff = 0.0
            dpw = 0.0

        if Cd * A > 0:
            ei = (v * SL) / (Cd * A) if (v > 0 and SL > 0) else 0.0
        else:
            ei = 0.0

        overall_eff = stroke_eff * propulsive_eff

        ep = EfficiencyPoint(
            idx=i,
            time=kp.time,
            position=kp.position,
            velocity=v,
            stroke_rate=kp.stroke_rate,
            stroke_length=SL,
            stroke_efficiency=stroke_eff,
            propulsive_efficiency=propulsive_eff,
            overall_efficiency=overall_eff,
            efficiency_index=ei,
            work_per_stroke=W,
            distance_per_work=dpw
        )
        result.points.append(ep)

    stroke_effs = [p.stroke_efficiency for p in result.points if p.stroke_efficiency > 0]
    overall_effs = [p.overall_efficiency for p in result.points if p.overall_efficiency > 0]
    eis = [p.efficiency_index for p in result.points if p.efficiency_index > 0]
    works = [p.work_per_stroke for p in result.points if p.work_per_stroke > 0]
    dpws = [p.distance_per_work for p in result.points if p.distance_per_work > 0]

    result.stats = {
        "avg_stroke_efficiency": sum(stroke_effs) / len(stroke_effs) if stroke_effs else 0,
        "max_stroke_efficiency": max(stroke_effs) if stroke_effs else 0,
        "min_stroke_efficiency": min(stroke_effs) if stroke_effs else 0,
        "avg_overall_efficiency": sum(overall_effs) / len(overall_effs) if overall_effs else 0,
        "max_overall_efficiency": max(overall_effs) if overall_effs else 0,
        "min_overall_efficiency": min(overall_effs) if overall_effs else 0,
        "avg_efficiency_index": sum(eis) / len(eis) if eis else 0,
        "max_efficiency_index": max(eis) if eis else 0,
        "avg_work_per_stroke": sum(works) / len(works) if works else 0,
        "max_work_per_stroke": max(works) if works else 0,
        "avg_distance_per_work": sum(dpws) / len(dpws) if dpws else 0,
        "propulsive_efficiency": propulsive_eff,
    }

    if overall_effs:
        avg_overall = result.stats["avg_overall_efficiency"]
        low_threshold = avg_overall * 0.85
        result.evidence["low_efficiency_threshold"] = {
            "avg_overall_efficiency": avg_overall,
            "threshold_85_percent": low_threshold,
            "formula": "低效率阈值 = 平均整体效率 × 0.85"
        }

        current_segment = None
        for i, p in enumerate(result.points):
            if p.overall_efficiency > 0 and p.overall_efficiency < low_threshold:
                if current_segment is None:
                    current_segment = {
                        "start_idx": i,
                        "start_time": p.time,
                        "start_position": p.position,
                        "min_efficiency": p.overall_efficiency,
                        "min_efficiency_at": i,
                        "avg_velocity": [p.velocity],
                        "avg_stroke_rate": [p.stroke_rate],
                        "avg_stroke_length": [p.stroke_length],
                        "point_count": 1
                    }
                else:
                    current_segment["point_count"] += 1
                    current_segment["avg_velocity"].append(p.velocity)
                    current_segment["avg_stroke_rate"].append(p.stroke_rate)
                    current_segment["avg_stroke_length"].append(p.stroke_length)
                    if p.overall_efficiency < current_segment["min_efficiency"]:
                        current_segment["min_efficiency"] = p.overall_efficiency
                        current_segment["min_efficiency_at"] = i
            else:
                if current_segment is not None and current_segment["point_count"] >= 3:
                    current_segment["end_idx"] = i - 1
                    current_segment["end_time"] = result.points[i-1].time
                    current_segment["end_position"] = result.points[i-1].position
                    current_segment["duration"] = current_segment["end_time"] - current_segment["start_time"]
                    current_segment["distance"] = current_segment["end_position"] - current_segment["start_position"]
                    current_segment["avg_velocity"] = sum(current_segment["avg_velocity"]) / len(current_segment["avg_velocity"])
                    current_segment["avg_stroke_rate"] = sum(current_segment["avg_stroke_rate"]) / len(current_segment["avg_stroke_rate"])
                    current_segment["avg_stroke_length"] = sum(current_segment["avg_stroke_length"]) / len(current_segment["avg_stroke_length"])
                    current_segment["efficiency_drop_pct"] = ((avg_overall - current_segment["min_efficiency"]) / avg_overall) * 100
                    current_segment["evidence"] = {
                        "kinematic_refs": list(range(current_segment["start_idx"], current_segment["end_idx"] + 1)),
                        "causes": _analyze_low_efficiency_causes(
                            result.points[current_segment["start_idx"]:current_segment["end_idx"] + 1],
                            result.stats
                        )
                    }
                    result.low_efficiency_segments.append(current_segment)
                current_segment = None

        if current_segment is not None and current_segment["point_count"] >= 3:
            current_segment["end_idx"] = len(result.points) - 1
            current_segment["end_time"] = result.points[-1].time
            current_segment["end_position"] = result.points[-1].position
            current_segment["duration"] = current_segment["end_time"] - current_segment["start_time"]
            current_segment["distance"] = current_segment["end_position"] - current_segment["start_position"]
            current_segment["avg_velocity"] = sum(current_segment["avg_velocity"]) / len(current_segment["avg_velocity"])
            current_segment["avg_stroke_rate"] = sum(current_segment["avg_stroke_rate"]) / len(current_segment["avg_stroke_rate"])
            current_segment["avg_stroke_length"] = sum(current_segment["avg_stroke_length"]) / len(current_segment["avg_stroke_length"])
            current_segment["efficiency_drop_pct"] = ((avg_overall - current_segment["min_efficiency"]) / avg_overall) * 100
            current_segment["evidence"] = {
                "kinematic_refs": list(range(current_segment["start_idx"], current_segment["end_idx"] + 1)),
                "causes": _analyze_low_efficiency_causes(
                    result.points[current_segment["start_idx"]:current_segment["end_idx"] + 1],
                    result.stats
                )
            }
            result.low_efficiency_segments.append(current_segment)

    return result


def _analyze_low_efficiency_causes(points: List[EfficiencyPoint], stats: Dict) -> List[str]:
    """分析低效率的可能原因"""
    causes = []
    if not points:
        return causes

    avg_v = sum(p.velocity for p in points) / len(points)
    avg_sr = sum(p.stroke_rate for p in points if p.stroke_rate > 0) / max(1, sum(1 for p in points if p.stroke_rate > 0))
    avg_sl = sum(p.stroke_length for p in points if p.stroke_length > 0) / max(1, sum(1 for p in points if p.stroke_length > 0))

    if avg_v < stats.get("avg_overall_efficiency", 0) * 0.5:
        causes.append("速度显著偏低")
    if avg_sr < stats.get("avg_stroke_rate", 30) * 0.75:
        causes.append("划水频率偏低，可能存在滑行过度")
    if avg_sr > stats.get("avg_stroke_rate", 30) * 1.3:
        causes.append("划水频率偏高，可能存在无效划水")
    if avg_sl < stats.get("avg_stroke_length", 1.5) * 0.75:
        causes.append("划水步幅偏小，推进力不足")
    if avg_sr > stats.get("avg_stroke_rate", 30) * 1.1 and avg_sl < stats.get("avg_stroke_length", 1.5) * 0.9:
        causes.append("高频小幅划水，典型低效模式")

    if not causes:
        causes.append("需要结合视频和教练观察进一步分析")

    return causes

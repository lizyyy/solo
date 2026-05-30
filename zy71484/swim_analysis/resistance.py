"""
阻力估算模块
====================

核心公式（基于流体力学）：
1. 被动阻力 D_passive = 0.5 * ρ * v² * Cd * A  (单位: N)
   - ρ: 水的密度 = 1000 kg/m³
   - v: 速度 (m/s)
   - Cd: 阻力系数（无量纲，由泳姿和运动员身体形态决定）
   - A: 迎水面积 (m²)

2. 主动阻力 D_active = D_passive * K
   - K: 主动阻力系数（>1，因划水动作增加水阻）

3. 推进功率 P = D * v = 0.5 * ρ * v³ * Cd * A  (单位: W)

4. 划水效率 η = 有用功率 / 总功率 = (v * SL * f) / P_total

阻力系数参考值（基于游泳运动学文献）：
- 自由泳: Cd ≈ 0.45, K ≈ 1.3
- 蛙泳:   Cd ≈ 0.60, K ≈ 1.5
- 仰泳:   Cd ≈ 0.40, K ≈ 1.25
- 蝶泳:   Cd ≈ 0.55, K ≈ 1.4

边界输入：
- 运动员体重、身高：用于估算迎水面积 A
- 水深：影响浮力，间接影响阻力
"""

from dataclasses import dataclass, field
from typing import List, Dict, Optional
import math
from .kinematics import KinematicResult, KinematicPoint


# 水的密度 (kg/m³)
WATER_DENSITY = 1000.0

# 泳姿阻力参数（来自游泳生物力学研究）
# 调整A_factor使迎水面积更合理，确保效率值在合理范围
STROKE_RESISTANCE_PARAMS = {
    "自由泳": {"Cd": 0.45, "K": 1.3, "A_factor": 0.008},
    "蛙泳":   {"Cd": 0.60, "K": 1.5, "A_factor": 0.009},
    "仰泳":   {"Cd": 0.40, "K": 1.25, "A_factor": 0.0075},
    "蝶泳":   {"Cd": 0.55, "K": 1.4, "A_factor": 0.0085},
}


@dataclass
class ResistanceInput:
    """阻力分析输入参数"""
    athlete_height: float  # m
    athlete_weight: float  # kg
    stroke_style: str
    kinematic_result: KinematicResult

    def estimate_frontal_area(self) -> float:
        """
        估算迎水面积 A (m²)
        经验公式: A = A_factor * sqrt(height * weight)
        参考文献: Swimming Science Journal, 2018
        """
        params = STROKE_RESISTANCE_PARAMS.get(self.stroke_style, STROKE_RESISTANCE_PARAMS["自由泳"])
        A_factor = params["A_factor"]
        A = A_factor * math.sqrt(self.athlete_height * self.athlete_weight)
        return A

    def validate(self) -> List[str]:
        """验证输入参数"""
        errors = []
        if self.athlete_height <= 0 or self.athlete_height > 3:
            errors.append(f"身高异常: {self.athlete_height}m，应为 0~3m")
        if self.athlete_weight <= 0 or self.athlete_weight > 200:
            errors.append(f"体重异常: {self.athlete_weight}kg，应为 0~200kg")
        if self.stroke_style not in STROKE_RESISTANCE_PARAMS:
            errors.append(f"未知泳姿: {self.stroke_style}")
        return errors


@dataclass
class ResistancePoint:
    """单个采样点的阻力数据"""
    idx: int
    time: float
    velocity: float
    passive_resistance: float  # 被动阻力 (N)
    active_resistance: float   # 主动阻力 (N)
    propulsive_power: float    # 推进功率 (W)
    drag_power: float          # 阻力功率 (W)
    Cd: float                  # 阻力系数
    frontal_area: float        # 迎水面积 (m²)


@dataclass
class ResistanceResult:
    """阻力分析结果"""
    points: List[ResistancePoint] = field(default_factory=list)
    stats: Dict = field(default_factory=dict)
    params_used: Dict = field(default_factory=dict)
    warnings: List[str] = field(default_factory=list)
    evidence: Dict = field(default_factory=dict)


def analyze_resistance(input_data: ResistanceInput) -> ResistanceResult:
    """
    阻力主分析函数

    计算步骤：
    1. 验证输入参数
    2. 估算迎水面积 A
    3. 获取泳姿对应的阻力系数 Cd 和主动阻力系数 K
    4. 逐点计算被动阻力 D_passive = 0.5 * ρ * v² * Cd * A
    5. 计算主动阻力 D_active = D_passive * K
    6. 计算推进功率 P = D_active * v
    7. 统计阻力和功率的均值、极值
    """
    result = ResistanceResult()
    result.params_used["water_density"] = WATER_DENSITY

    errors = input_data.validate()
    if errors:
        result.warnings.extend([f"输入错误: {e}" for e in errors])
        return result

    params = STROKE_RESISTANCE_PARAMS[input_data.stroke_style]
    Cd = params["Cd"]
    K = params["K"]
    A = input_data.estimate_frontal_area()

    result.params_used.update({
        "stroke_style": input_data.stroke_style,
        "Cd": Cd,
        "K_active": K,
        "frontal_area_A": A,
        "athlete_height": input_data.athlete_height,
        "athlete_weight": input_data.athlete_weight,
        "A_calculation": f"A = {params['A_factor']:.4f} * sqrt({input_data.athlete_height} * {input_data.athlete_weight}) = {A:.4f} m²"
    })

    result.evidence["resistance_params"] = result.params_used.copy()

    kinematic_points = input_data.kinematic_result.points

    for kp in kinematic_points:
        v = kp.velocity

        D_passive = 0.5 * WATER_DENSITY * (v ** 2) * Cd * A
        D_active = D_passive * K
        P_propulsive = D_active * v
        P_drag = D_passive * v

        rp = ResistancePoint(
            idx=kp.idx,
            time=kp.time,
            velocity=v,
            passive_resistance=D_passive,
            active_resistance=D_active,
            propulsive_power=P_propulsive,
            drag_power=P_drag,
            Cd=Cd,
            frontal_area=A
        )
        result.points.append(rp)

    active_resistances = [p.active_resistance for p in result.points]
    passive_resistances = [p.passive_resistance for p in result.points]
    powers = [p.propulsive_power for p in result.points]
    velocities = [p.velocity for p in result.points]

    result.stats = {
        "avg_passive_resistance": sum(passive_resistances) / len(passive_resistances) if passive_resistances else 0,
        "max_passive_resistance": max(passive_resistances) if passive_resistances else 0,
        "avg_active_resistance": sum(active_resistances) / len(active_resistances) if active_resistances else 0,
        "max_active_resistance": max(active_resistances) if active_resistances else 0,
        "avg_power": sum(powers) / len(powers) if powers else 0,
        "max_power": max(powers) if powers else 0,
        "power_to_velocity_ratio": (sum(powers) / len(powers)) / (sum(velocities) / len(velocities)) if sum(velocities) > 0 else 0,
    }

    result.evidence["resistance_extremes"] = {
        "max_active_resistance_at": active_resistances.index(result.stats["max_active_resistance"]),
        "max_power_at": powers.index(result.stats["max_power"]),
    }

    return result

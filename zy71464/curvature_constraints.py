import numpy as np
from typing import Dict, Tuple, List, Optional
from dataclasses import dataclass, field
from models import RobotParams, Pose


@dataclass
class CurvatureCalculation:
    formula: str
    units: Dict[str, str]
    inputs: Dict[str, float]
    intermediate: Dict[str, float]
    result: float
    boundary_check: Dict[str, bool]
    reasoning: str


class CurvatureConstraint:
    UNITS = {
        "wheelbase": "m",
        "steering_angle": "rad",
        "turning_radius": "m",
        "curvature": "1/m",
        "speed": "m/s",
        "angular_velocity": "rad/s",
        "distance": "m",
    }

    FORMULAS = {
        "curvature_from_steering": "κ = tan(δ) / L",
        "turning_radius_from_curvature": "R = 1 / κ",
        "turning_radius_from_steering": "R = L / tan(δ)",
        "steering_from_curvature": "δ = arctan(κ * L)",
        "speed_from_curvature": "v(κ) = v_max * (1 - κ/κ_max)",
        "curvature_from_path": "κ = |θ₂ - θ₁| / Δs",
    }

    def __init__(self, robot_params: RobotParams):
        self.robot_params = robot_params
        self._calculation_history: List[CurvatureCalculation] = []

    def calculate_curvature_from_steering(self, steering_angle: float) -> CurvatureCalculation:
        formula = self.FORMULAS["curvature_from_steering"]
        L = self.robot_params.wheelbase
        delta = steering_angle
        delta_max = self.robot_params.max_steering_angle

        tan_delta = np.tan(delta)
        curvature = tan_delta / L if abs(tan_delta) > 1e-10 else 0.0

        boundary_check = {
            "steering_within_limit": abs(steering_angle) <= delta_max + 1e-8,
            "curvature_within_limit": abs(curvature) <= self.robot_params.max_curvature + 1e-8,
        }

        if not boundary_check["steering_within_limit"]:
            reasoning = (f"转向角 {np.degrees(steering_angle):.1f}° 超过最大限制 "
                        f"{np.degrees(delta_max):.1f}°，曲率被截断到最大允许值")
            curvature = np.sign(curvature) * self.robot_params.max_curvature
        elif not boundary_check["curvature_within_limit"]:
            reasoning = (f"计算曲率 {curvature:.4f} 1/m 超过最大曲率限制 "
                        f"{self.robot_params.max_curvature:.4f} 1/m，已截断")
            curvature = np.sign(curvature) * self.robot_params.max_curvature
        else:
            reasoning = (f"根据公式 {formula}，轴距 L={L}{self.UNITS['wheelbase']}，"
                        f"转向角 δ={np.degrees(delta):.1f}°，计算得曲率 κ={curvature:.4f} 1/m")

        calc = CurvatureCalculation(
            formula=formula,
            units=self.UNITS,
            inputs={
                "wheelbase": L,
                "steering_angle": delta,
                "max_steering_angle": delta_max,
            },
            intermediate={
                "tan(steering_angle)": tan_delta,
            },
            result=curvature,
            boundary_check=boundary_check,
            reasoning=reasoning,
        )
        self._calculation_history.append(calc)
        return calc

    def calculate_steering_from_curvature(self, curvature: float) -> CurvatureCalculation:
        formula = self.FORMULAS["steering_from_curvature"]
        L = self.robot_params.wheelbase
        kappa = curvature
        kappa_max = self.robot_params.max_curvature

        kappa_L = kappa * L
        steering_angle = np.arctan(kappa_L)

        boundary_check = {
            "curvature_within_limit": abs(curvature) <= kappa_max + 1e-8,
            "steering_within_limit": abs(steering_angle) <= self.robot_params.max_steering_angle + 1e-8,
        }

        if not boundary_check["curvature_within_limit"]:
            reasoning = (f"曲率 {curvature:.4f} 1/m 超过最大限制 {kappa_max:.4f} 1/m，"
                        f"转向角按最大曲率计算")
            curvature = np.sign(curvature) * kappa_max
            kappa_L = curvature * L
            steering_angle = np.arctan(kappa_L)
        else:
            reasoning = (f"根据公式 {formula}，轴距 L={L}{self.UNITS['wheelbase']}，"
                        f"曲率 κ={curvature:.4f} 1/m，计算得转向角 δ={np.degrees(steering_angle):.1f}°")

        calc = CurvatureCalculation(
            formula=formula,
            units=self.UNITS,
            inputs={
                "wheelbase": L,
                "curvature": curvature,
                "max_curvature": kappa_max,
            },
            intermediate={
                "kappa * wheelbase": kappa_L,
            },
            result=steering_angle,
            boundary_check=boundary_check,
            reasoning=reasoning,
        )
        self._calculation_history.append(calc)
        return calc

    def calculate_turning_radius(self, curvature_or_steering: float, is_steering: bool = False) -> CurvatureCalculation:
        if is_steering:
            formula = self.FORMULAS["turning_radius_from_steering"]
            steering = curvature_or_steering
            L = self.robot_params.wheelbase
            tan_steering = np.tan(steering)
            turning_radius = L / tan_steering if abs(tan_steering) > 1e-10 else float('inf')

            boundary_check = {
                "steering_nonzero": abs(steering) > 1e-8,
                "radius_ge_min": turning_radius >= self.robot_params.min_turning_radius - 1e-8,
            }

            reasoning = (f"根据公式 {formula}，轴距 L={L}{self.UNITS['wheelbase']}，"
                        f"转向角 δ={np.degrees(steering):.1f}°，计算得转弯半径 R={turning_radius:.2f} m")

            inputs = {"wheelbase": L, "steering_angle": steering}
            intermediate = {"tan(steering_angle)": tan_steering}
        else:
            formula = self.FORMULAS["turning_radius_from_curvature"]
            curvature = curvature_or_steering
            turning_radius = 1.0 / curvature if abs(curvature) > 1e-10 else float('inf')

            boundary_check = {
                "curvature_nonzero": abs(curvature) > 1e-8,
                "radius_ge_min": turning_radius >= self.robot_params.min_turning_radius - 1e-8,
            }

            reasoning = (f"根据公式 {formula}，曲率 κ={curvature:.4f} 1/m，"
                        f"计算得转弯半径 R={turning_radius:.2f} m")

            inputs = {"curvature": curvature}
            intermediate = {}

        if not boundary_check["radius_ge_min"] and turning_radius != float('inf'):
            reasoning += (f"，注意：转弯半径 {turning_radius:.2f} m 小于最小允许半径 "
                         f"{self.robot_params.min_turning_radius:.2f} m")

        calc = CurvatureCalculation(
            formula=formula,
            units=self.UNITS,
            inputs=inputs,
            intermediate=intermediate,
            result=turning_radius,
            boundary_check=boundary_check,
            reasoning=reasoning,
        )
        self._calculation_history.append(calc)
        return calc

    def calculate_curvature_from_path(self, pose1: Pose, pose2: Pose, delta_s: float) -> CurvatureCalculation:
        formula = self.FORMULAS["curvature_from_path"]

        theta1 = pose1.theta
        theta2 = pose2.theta

        delta_theta = theta2 - theta1
        delta_theta = np.arctan2(np.sin(delta_theta), np.cos(delta_theta))

        curvature = abs(delta_theta) / delta_s if delta_s > 1e-10 else 0.0
        signed_curvature = delta_theta / delta_s if delta_s > 1e-10 else 0.0

        boundary_check = {
            "distance_positive": delta_s > 1e-8,
            "curvature_within_limit": abs(signed_curvature) <= self.robot_params.max_curvature + 1e-8,
        }

        if not boundary_check["curvature_within_limit"]:
            reasoning = (f"路径段曲率 {abs(signed_curvature):.4f} 1/m 超过最大限制 "
                        f"{self.robot_params.max_curvature:.4f} 1/m，"
                        f"两点航向差 {np.degrees(abs(delta_theta)):.1f}°，距离 {delta_s:.2f} m")
        else:
            reasoning = (f"根据公式 {formula}，两点航向差 Δθ={np.degrees(delta_theta):.1f}°，"
                        f"弧长 Δs={delta_s:.2f} m，计算得曲率 κ={abs(signed_curvature):.4f} 1/m")

        calc = CurvatureCalculation(
            formula=formula,
            units=self.UNITS,
            inputs={
                "theta1": theta1,
                "theta2": theta2,
                "delta_s": delta_s,
            },
            intermediate={
                "delta_theta": delta_theta,
                "abs_delta_theta": abs(delta_theta),
            },
            result=signed_curvature,
            boundary_check=boundary_check,
            reasoning=reasoning,
        )
        self._calculation_history.append(calc)
        return calc

    def calculate_speed_for_curvature(self, curvature: float) -> CurvatureCalculation:
        formula = self.FORMULAS["speed_from_curvature"]
        v_max = self.robot_params.max_speed
        kappa_max = self.robot_params.max_curvature
        kappa = abs(curvature)

        ratio = kappa / kappa_max if kappa_max > 1e-10 else 0.0
        speed = v_max * (1.0 - ratio)
        speed = max(0.0, speed)

        boundary_check = {
            "curvature_within_limit": kappa <= kappa_max + 1e-8,
            "speed_nonnegative": speed >= 0.0,
        }

        if ratio > 1.0:
            reasoning = (f"曲率 {kappa:.4f} 1/m 超过最大曲率 {kappa_max:.4f} 1/m，"
                        f"速度降至 0 m/s（无法通过该曲率）")
            speed = 0.0
        else:
            reasoning = (f"根据公式 {formula}，最大速度 v_max={v_max:.2f} m/s，"
                        f"曲率比 κ/κ_max={ratio:.2%}，计算得允许速度 v={speed:.2f} m/s")

        calc = CurvatureCalculation(
            formula=formula,
            units=self.UNITS,
            inputs={
                "curvature": curvature,
                "max_curvature": kappa_max,
                "max_speed": v_max,
            },
            intermediate={
                "curvature_ratio": ratio,
            },
            result=speed,
            boundary_check=boundary_check,
            reasoning=reasoning,
        )
        self._calculation_history.append(calc)
        return calc

    def check_feasible_arc(self, start_pose: Pose, end_pose: Pose) -> Tuple[bool, CurvatureCalculation, str]:
        dx = end_pose.x - start_pose.x
        dy = end_pose.y - start_pose.y
        delta_s = np.sqrt(dx * dx + dy * dy)

        if delta_s < 1e-8:
            calc = self.calculate_curvature_from_path(start_pose, end_pose, delta_s)
            return True, calc, "两点重合，视为可行（零曲率）"

        calc = self.calculate_curvature_from_path(start_pose, end_pose, delta_s)
        feasible = calc.boundary_check["curvature_within_limit"]

        if feasible:
            reason = (f"圆弧可行：曲率 {abs(calc.result):.4f} 1/m ≤ 最大曲率 "
                     f"{self.robot_params.max_curvature:.4f} 1/m")
        else:
            reason = (f"圆弧不可行：所需曲率 {abs(calc.result):.4f} 1/m > 最大曲率 "
                     f"{self.robot_params.max_curvature:.4f} 1/m，"
                     f"最小转弯半径 {self.robot_params.min_turning_radius:.2f} m 不足以完成此转向")

        return feasible, calc, reason

    def get_history(self) -> List[CurvatureCalculation]:
        return self._calculation_history.copy()

    def clear_history(self) -> None:
        self._calculation_history.clear()

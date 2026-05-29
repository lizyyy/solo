from __future__ import annotations

import math
from datetime import datetime

from doppler.models import CalibrationParams, ProcessingStep


SPEED_OF_LIGHT = 299792458.0


def frequency_shift_to_speed(
    frequency_shift_hz: float,
    calibration: CalibrationParams,
) -> tuple[float, list[ProcessingStep]]:
    steps: list[ProcessingStep] = []
    now = datetime.now()

    c = calibration.speed_of_light
    steps.append(ProcessingStep(
        step_number=1,
        step_name="确认物理常量",
        description="取光速 c 值",
        input_value=f"光速 = {c} m/s",
        output_value=f"c = {c} m/s",
        timestamp=now,
    ))

    f0 = calibration.radar_freq_hz
    steps.append(ProcessingStep(
        step_number=2,
        step_name="确认雷达发射频率",
        description="取雷达载波频率 f₀",
        input_value=f"雷达频率 = {f0} Hz",
        output_value=f"f₀ = {f0} Hz",
        timestamp=now,
    ))

    theta_rad = math.radians(calibration.angle_deg)
    steps.append(ProcessingStep(
        step_number=3,
        step_name="角度转弧度",
        description="将波束夹角从角度转为弧度",
        input_value=f"θ = {calibration.angle_deg}°",
        output_value=f"θ = {theta_rad:.6f} rad",
        timestamp=now,
    ))

    cos_theta = math.cos(theta_rad)
    steps.append(ProcessingStep(
        step_number=4,
        step_name="计算 cos(θ)",
        description="计算波束夹角的余弦值",
        input_value=f"cos({theta_rad:.6f})",
        output_value=f"cos(θ) = {cos_theta:.6f}",
        timestamp=now,
    ))

    if abs(cos_theta) < 1e-9:
        raise ValueError(f"cos(θ) ≈ 0，夹角接近 90°，无法测速。θ = {calibration.angle_deg}°")

    raw_speed = abs(frequency_shift_hz) * c / (2.0 * f0 * cos_theta)
    steps.append(ProcessingStep(
        step_number=5,
        step_name="多普勒频移换算速度",
        description="v = |Δf| × c / (2 × f₀ × cos(θ))",
        input_value=f"|Δf| = {abs(frequency_shift_hz)} Hz, c = {c}, f₀ = {f0}, cos(θ) = {cos_theta:.6f}",
        output_value=f"v = {raw_speed:.6f} m/s",
        timestamp=now,
    ))

    calibrated_speed = raw_speed * calibration.scale_factor + calibration.offset_mps
    steps.append(ProcessingStep(
        step_number=6,
        step_name="应用校准参数",
        description=f"v_cal = v × scale_factor + offset (版本: {calibration.version})",
        input_value=f"v = {raw_speed:.6f}, scale = {calibration.scale_factor}, offset = {calibration.offset_mps}",
        output_value=f"v_cal = {calibrated_speed:.6f} m/s",
        timestamp=now,
    ))

    speed_kmh = calibrated_speed * 3.6
    steps.append(ProcessingStep(
        step_number=7,
        step_name="换算为 km/h",
        description="1 m/s = 3.6 km/h",
        input_value=f"{calibrated_speed:.6f} m/s",
        output_value=f"{speed_kmh:.4f} km/h",
        timestamp=now,
    ))

    return calibrated_speed, steps

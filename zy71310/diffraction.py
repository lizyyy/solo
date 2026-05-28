import math
from typing import Dict, List, Optional, Tuple, Any
from models import (
    GratingConstant,
    FringePosition,
    ScreenDistance,
    WavelengthResult,
    StudentRecord,
    AnalysisStep,
    AngleUnit,
    SourceType,
)


def convert_angle(angle: float, from_unit: AngleUnit, to_unit: AngleUnit) -> float:
    if from_unit == to_unit:
        return angle
    if from_unit == AngleUnit.DEGREE and to_unit == AngleUnit.RADIAN:
        return math.radians(angle)
    if from_unit == AngleUnit.RADIAN and to_unit == AngleUnit.DEGREE:
        return math.degrees(angle)
    if from_unit == AngleUnit.ARCMINUTE and to_unit == AngleUnit.DEGREE:
        return angle / 60.0
    if from_unit == AngleUnit.DEGREE and to_unit == AngleUnit.ARCMINUTE:
        return angle * 60.0
    if from_unit == AngleUnit.ARCMINUTE and to_unit == AngleUnit.RADIAN:
        return math.radians(angle / 60.0)
    if from_unit == AngleUnit.RADIAN and to_unit == AngleUnit.ARCMINUTE:
        return math.degrees(angle) * 60.0
    raise ValueError(f"不支持的角度单位转换: {from_unit} -> {to_unit}")


def calculate_angle_from_position(
    fringe_position: float, screen_distance: float
) -> float:
    if screen_distance <= 0:
        raise ValueError(f"屏距必须为正值，当前值: {screen_distance}")
    return math.atan(fringe_position / screen_distance)


def calculate_angle(
    fringe: FringePosition, screen_distance: ScreenDistance
) -> Tuple[float, Dict[str, Any]]:
    trace_info = {
        "fringe_id": fringe.source_id,
        "screen_distance_id": screen_distance.source_id,
        "calculation_method": "",
        "raw_inputs": {},
    }

    if fringe.angle is not None:
        trace_info["calculation_method"] = "direct_angle"
        trace_info["raw_inputs"] = {
            "angle": fringe.angle,
            "unit": fringe.angle_unit.value,
        }
        angle_rad = convert_angle(fringe.angle, fringe.angle_unit, AngleUnit.RADIAN)
        return angle_rad, trace_info

    trace_info["calculation_method"] = "position_to_angle"
    trace_info["raw_inputs"] = {
        "fringe_position": fringe.position,
        "fringe_position_unit": fringe.unit,
        "screen_distance": screen_distance.value,
        "screen_distance_unit": screen_distance.unit,
    }
    angle_rad = calculate_angle_from_position(fringe.position, screen_distance.value)
    return angle_rad, trace_info


def grating_equation(
    d: float, theta: float, k: int
) -> Tuple[float, Dict[str, Any]]:
    if k == 0:
        raise ValueError("零级条纹无法计算波长")
    if d <= 0:
        raise ValueError(f"光栅常数必须为正值，当前值: {d}")

    sin_theta = math.sin(theta)
    if abs(sin_theta) > 1:
        raise ValueError(
            f"sin(theta) = {sin_theta:.4f} 超出范围 [-1, 1]，"
            f"theta = {math.degrees(theta):.2f}°，请检查数据"
        )

    lambda_m = d * abs(sin_theta) / abs(k)

    trace_info = {
        "grating_constant": d,
        "angle_rad": theta,
        "angle_deg": math.degrees(theta),
        "sin_theta": sin_theta,
        "order": k,
        "equation": "λ = d * sin(θ) / |k|",
        "calculation": f"λ = {d:.6e} * {sin_theta:.6f} / {abs(k)} = {lambda_m:.6e} m",
    }

    return lambda_m, trace_info


def calculate_wavelength(
    grating_constant: GratingConstant,
    fringe: FringePosition,
    screen_distance: ScreenDistance,
    parent_step_id: Optional[str] = None,
) -> Tuple[WavelengthResult, Dict[str, Any]]:
    angle_rad, angle_trace = calculate_angle(fringe, screen_distance)
    lambda_m, equation_trace = grating_equation(
        grating_constant.value, angle_rad, fringe.order
    )

    result = WavelengthResult(
        value=lambda_m,
        unit="m",
        order=fringe.order,
        fringe_id=fringe.source_id,
        source_type=SourceType.CALCULATED,
        parent_ids=[
            grating_constant.source_id,
            fringe.source_id,
            screen_distance.source_id,
        ],
        notes=f"由第{fringe.order}级条纹计算，使用{angle_trace['calculation_method']}方法",
    )

    if parent_step_id:
        result.parent_ids.append(parent_step_id)

    full_trace = {
        "angle_calculation": angle_trace,
        "grating_equation": equation_trace,
        "wavelength_nm": lambda_m * 1e9,
        "result_id": result.source_id,
    }

    return result, full_trace


def calculate_wavelengths(
    student_record: StudentRecord,
    parent_step_id: Optional[str] = None,
) -> Tuple[List[WavelengthResult], List[Dict[str, Any]]]:
    if student_record.grating_constant is None:
        raise ValueError("缺少光栅常数数据")
    if student_record.screen_distance is None:
        raise ValueError("缺少屏距数据")
    if not student_record.fringes:
        raise ValueError("缺少条纹位置数据")

    results = []
    traces = []

    for fringe in student_record.fringes:
        if fringe.order == 0:
            continue
        try:
            result, trace = calculate_wavelength(
                student_record.grating_constant,
                fringe,
                student_record.screen_distance,
                parent_step_id,
            )
            results.append(result)
            traces.append(trace)
        except Exception as e:
            error_trace = {
                "fringe_id": fringe.source_id,
                "order": fringe.order,
                "error": str(e),
                "success": False,
            }
            traces.append(error_trace)

    return results, traces


def calculate_average_wavelength(
    results: List[WavelengthResult],
    weights: Optional[List[float]] = None,
) -> Tuple[float, Dict[str, Any]]:
    if not results:
        raise ValueError("没有可用于平均的波长结果")

    values = [r.value for r in results]

    if weights is None:
        weights = [1.0 / len(values)] * len(values)
    else:
        total_weight = sum(weights)
        weights = [w / total_weight for w in weights]

    avg = sum(w * v for w, v in zip(weights, values))

    trace = {
        "individual_values": [
            {"order": r.order, "wavelength_m": r.value, "wavelength_nm": r.value * 1e9}
            for r in results
        ],
        "weights": weights,
        "average_m": avg,
        "average_nm": avg * 1e9,
        "calculation": f"加权平均 = {' + '.join([f'{w:.3f}×{v:.6e}' for w, v in zip(weights, values)])} = {avg:.6e} m",
    }

    return avg, trace


def create_diffraction_step(
    student_record: StudentRecord,
) -> AnalysisStep:
    step = AnalysisStep(
        step_name="衍射计算",
        source_type=SourceType.CALCULATED,
        parent_ids=[student_record.source_id],
        notes="使用光栅方程 d·sin(θ) = k·λ 从条纹位置反推波长",
        input_data={
            "student_record_id": student_record.source_id,
            "grating_constant": (
                student_record.grating_constant.value
                if student_record.grating_constant
                else None
            ),
            "screen_distance": (
                student_record.screen_distance.value
                if student_record.screen_distance
                else None
            ),
            "fringe_count": len(student_record.fringes),
        },
    )
    return step

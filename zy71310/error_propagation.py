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


def partial_derivative_theta_x(x: float, L: float) -> float:
    denominator = x * x + L * L
    if denominator == 0:
        raise ValueError("x和L不能同时为0")
    return L / denominator


def partial_derivative_theta_L(x: float, L: float) -> float:
    denominator = x * x + L * L
    if denominator == 0:
        raise ValueError("x和L不能同时为0")
    return -x / denominator


def calculate_angle_uncertainty(
    fringe: FringePosition,
    screen_distance: ScreenDistance,
) -> Tuple[float, Dict[str, Any]]:
    trace = {
        "method": "",
        "components": {},
        "raw_inputs": {},
    }

    if fringe.angle is not None:
        trace["method"] = "direct_angle_uncertainty"
        if fringe.angle_unit == AngleUnit.DEGREE:
            delta_theta_rad = math.radians(fringe.uncertainty)
        elif fringe.angle_unit == AngleUnit.ARCMINUTE:
            delta_theta_rad = math.radians(fringe.uncertainty / 60.0)
        else:
            delta_theta_rad = fringe.uncertainty

        trace["components"] = {
            "delta_theta": fringe.uncertainty,
            "unit": fringe.angle_unit.value,
            "delta_theta_rad": delta_theta_rad,
        }
        trace["raw_inputs"] = {
            "angle_uncertainty": fringe.uncertainty,
            "angle_unit": fringe.angle_unit.value,
        }
        return delta_theta_rad, trace

    trace["method"] = "position_propagation"

    x = fringe.position
    L = screen_distance.value
    delta_x = fringe.uncertainty
    delta_L = screen_distance.uncertainty

    dtheta_dx = partial_derivative_theta_x(x, L)
    dtheta_dL = partial_derivative_theta_L(x, L)

    delta_theta_x = abs(dtheta_dx) * delta_x
    delta_theta_L = abs(dtheta_dL) * delta_L

    delta_theta_rad = math.sqrt(delta_theta_x ** 2 + delta_theta_L ** 2)

    trace["components"] = {
        "dtheta/dx": dtheta_dx,
        "dtheta/dL": dtheta_dL,
        "delta_theta_x": delta_theta_x,
        "delta_theta_L": delta_theta_L,
        "delta_theta_rad": delta_theta_rad,
        "formula": "Δθ = √[(∂θ/∂x·Δx)² + (∂θ/∂L·ΔL)²]",
        "calculation": (
            f"Δθ = √[({dtheta_dx:.6e}×{delta_x:.6e})² + "
            f"({abs(dtheta_dL):.6e}×{delta_L:.6e})²] = "
            f"√[{delta_theta_x:.6e}² + {delta_theta_L:.6e}²] = "
            f"{delta_theta_rad:.6e} rad"
        ),
    }
    trace["raw_inputs"] = {
        "fringe_position": x,
        "fringe_position_uncertainty": delta_x,
        "screen_distance": L,
        "screen_distance_uncertainty": delta_L,
    }

    return delta_theta_rad, trace


def calculate_wavelength_uncertainty(
    grating_constant: GratingConstant,
    fringe: FringePosition,
    screen_distance: ScreenDistance,
    wavelength_value: Optional[float] = None,
) -> Tuple[float, Dict[str, Any]]:
    import diffraction as diff

    theta_rad, angle_trace = diff.calculate_angle(fringe, screen_distance)
    delta_theta_rad, delta_theta_trace = calculate_angle_uncertainty(
        fringe, screen_distance
    )

    d = grating_constant.value
    delta_d = grating_constant.uncertainty
    k = abs(fringe.order)
    sin_theta = math.sin(theta_rad)
    cos_theta = math.cos(theta_rad)

    if wavelength_value is None:
        lambda_m = d * sin_theta / k
    else:
        lambda_m = wavelength_value

    relative_d = delta_d / d if d != 0 else 0
    relative_theta = abs(cos_theta / sin_theta * delta_theta_rad) if sin_theta != 0 else 0

    relative_uncertainty = math.sqrt(relative_d ** 2 + relative_theta ** 2)
    delta_lambda = lambda_m * relative_uncertainty

    trace = {
        "angle_uncertainty": delta_theta_trace,
        "components": {
            "grating_constant": d,
            "grating_constant_uncertainty": delta_d,
            "angle_rad": theta_rad,
            "angle_deg": math.degrees(theta_rad),
            "angle_uncertainty_rad": delta_theta_rad,
            "sin_theta": sin_theta,
            "cos_theta": cos_theta,
            "order": k,
            "wavelength_m": lambda_m,
            "relative_uncertainty_d": relative_d,
            "relative_uncertainty_theta": relative_theta,
            "total_relative_uncertainty": relative_uncertainty,
            "absolute_uncertainty": delta_lambda,
            "formula": "(Δλ/λ)² = (Δd/d)² + (cot(θ)·Δθ)²",
            "calculation": (
                f"(Δλ/λ)² = ({delta_d:.6e}/{d:.6e})² + "
                f"({cos_theta:.6f}/{sin_theta:.6f}×{delta_theta_rad:.6e})²\n"
                f"       = {relative_d**2:.6e} + {relative_theta**2:.6e} = {relative_uncertainty**2:.6e}\n"
                f"Δλ/λ = {relative_uncertainty:.4f} ({relative_uncertainty*100:.2f}%)\n"
                f"Δλ = {lambda_m:.6e} × {relative_uncertainty:.4f} = {delta_lambda:.6e} m"
            ),
        },
    }

    return delta_lambda, trace


def propagate_uncertainties(
    student_record: StudentRecord,
    wavelength_results: List[WavelengthResult],
    parent_step_id: Optional[str] = None,
) -> Tuple[List[WavelengthResult], List[Dict[str, Any]]]:
    if student_record.grating_constant is None:
        raise ValueError("缺少光栅常数数据")
    if student_record.screen_distance is None:
        raise ValueError("缺少屏距数据")

    updated_results = []
    traces = []

    fringe_map = {f.source_id: f for f in student_record.fringes}

    for result in wavelength_results:
        fringe = fringe_map.get(result.fringe_id)
        if fringe is None:
            traces.append(
                {
                    "result_id": result.source_id,
                    "error": "找不到对应的条纹数据",
                    "success": False,
                }
            )
            updated_results.append(result)
            continue

        try:
            delta_lambda, trace = calculate_wavelength_uncertainty(
                student_record.grating_constant,
                fringe,
                student_record.screen_distance,
                result.value,
            )

            result.uncertainty = delta_lambda
            if parent_step_id and parent_step_id not in result.parent_ids:
                result.parent_ids.append(parent_step_id)

            trace["result_id"] = result.source_id
            trace["success"] = True
            trace["wavelength_nm"] = result.value * 1e9
            trace["uncertainty_nm"] = delta_lambda * 1e9
            trace["relative_uncertainty_percent"] = (
                delta_lambda / result.value * 100 if result.value != 0 else 0
            )

            updated_results.append(result)
            traces.append(trace)
        except Exception as e:
            traces.append(
                {
                    "result_id": result.source_id,
                    "error": str(e),
                    "success": False,
                }
            )
            updated_results.append(result)

    return updated_results, traces


def calculate_final_uncertainty(
    results: List[WavelengthResult],
) -> Tuple[float, Dict[str, Any]]:
    if not results:
        raise ValueError("没有可用于计算的波长结果")

    values = [r.value for r in results]
    uncertainties = [r.uncertainty for r in results]

    weights = [1.0 / (u * u) if u > 0 else 1.0 for u in uncertainties]
    total_weight = sum(weights)
    normalized_weights = [w / total_weight for w in weights]

    weighted_avg = sum(w * v for w, v in zip(normalized_weights, values))

    final_uncertainty = math.sqrt(1.0 / total_weight)

    trace = {
        "individual_results": [
            {
                "order": r.order,
                "wavelength_m": r.value,
                "wavelength_nm": r.value * 1e9,
                "uncertainty_m": r.uncertainty,
                "uncertainty_nm": r.uncertainty * 1e9,
                "weight": w,
            }
            for r, w in zip(results, normalized_weights)
        ],
        "weighted_average_m": weighted_avg,
        "weighted_average_nm": weighted_avg * 1e9,
        "final_uncertainty_m": final_uncertainty,
        "final_uncertainty_nm": final_uncertainty * 1e9,
        "relative_uncertainty_percent": (
            final_uncertainty / weighted_avg * 100 if weighted_avg != 0 else 0
        ),
        "formula": (
            "加权平均: λ_avg = Σ(w_i·λ_i), 其中 w_i = 1/σ_i²\n"
            "不确定度: σ_avg = 1/√(Σ1/σ_i²)"
        ),
    }

    return final_uncertainty, trace


def create_error_propagation_step(
    student_record: StudentRecord,
    wavelength_results: List[WavelengthResult],
) -> AnalysisStep:
    step = AnalysisStep(
        step_name="误差传播分析",
        source_type=SourceType.CALCULATED,
        parent_ids=[student_record.source_id] + [r.source_id for r in wavelength_results],
        notes="基于误差传播公式计算各测量量不确定度对波长的影响",
        input_data={
            "student_record_id": student_record.source_id,
            "grating_constant_uncertainty": (
                student_record.grating_constant.uncertainty
                if student_record.grating_constant
                else None
            ),
            "screen_distance_uncertainty": (
                student_record.screen_distance.uncertainty
                if student_record.screen_distance
                else None
            ),
            "result_count": len(wavelength_results),
        },
    )
    return step

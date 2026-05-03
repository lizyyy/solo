"""
校准曲线计算模块
"""

from typing import Dict, List, Tuple, Any
import numpy as np
from dataclasses import asdict

from .models import (
    InjectionRecord,
    SampleType,
    CalibrationCurve,
    CalibrationPoint,
    QCIssue,
    QCIssueType,
    BatchData,
)


def linear_regression(x: List[float], y: List[float]) -> Tuple[float, float, float]:
    x_arr = np.array(x)
    y_arr = np.array(y)
    
    n = len(x_arr)
    if n < 2:
        return 0.0, 0.0, 0.0
    
    x_mean = np.mean(x_arr)
    y_mean = np.mean(y_arr)
    
    ss_xy = np.sum((x_arr - x_mean) * (y_arr - y_mean))
    ss_xx = np.sum((x_arr - x_mean) ** 2)
    
    if ss_xx == 0:
        return 0.0, 0.0, 0.0
    
    slope = ss_xy / ss_xx
    intercept = y_mean - slope * x_mean
    
    y_pred = slope * x_arr + intercept
    ss_total = np.sum((y_arr - y_mean) ** 2)
    ss_residual = np.sum((y_arr - y_pred) ** 2)
    
    if ss_total == 0:
        r_squared = 1.0
    else:
        r_squared = 1.0 - (ss_residual / ss_total)
    
    return slope, intercept, r_squared


def calculate_lod(
    calibration_points: List[CalibrationPoint],
    slope: float,
    n_replicates: int = 3,
) -> float:
    if len(calibration_points) < 2 or slope == 0:
        return 0.0
    
    low_conc_points = [p for p in calibration_points if p.concentration <= calibration_points[2].concentration]
    if len(low_conc_points) < 2:
        low_conc_points = calibration_points[:3]
    
    ratios = [p.ratio for p in low_conc_points]
    if len(ratios) < 2:
        return 0.0
    
    std_dev = np.std(ratios)
    lod = (3.3 * std_dev) / slope
    
    return max(lod, 0.0)


def calculate_loq(
    calibration_points: List[CalibrationPoint],
    slope: float,
) -> float:
    if len(calibration_points) < 2 or slope == 0:
        return 0.0
    
    low_conc_points = [p for p in calibration_points if p.concentration <= calibration_points[2].concentration]
    if len(low_conc_points) < 2:
        low_conc_points = calibration_points[:3]
    
    ratios = [p.ratio for p in low_conc_points]
    if len(ratios) < 2:
        return 0.0
    
    std_dev = np.std(ratios)
    loq = (10 * std_dev) / slope
    
    return max(loq, 0.0)


def build_calibration_curves(
    batch_data: BatchData,
    calibration_config: Dict[str, Any],
) -> Dict[str, CalibrationCurve]:
    compounds_config = calibration_config.get("compounds", {})
    calibrators = batch_data.get_samples_by_type(SampleType.CALIBRATOR)
    
    calibration_curves = {}
    issues = []
    
    for compound_name, compound_config in compounds_config.items():
        internal_standard = compound_config.get("internal_standard", f"IS_{compound_name}")
        calibration_levels = compound_config.get("calibration_levels", [])
        
        calibration_points = []
        
        for idx, injection in enumerate(calibrators):
            conc_key = None
            for level in calibration_levels:
                if level.get("name", "") in injection.sample_id or \
                   level.get("name", "").upper() in injection.sample_id.upper():
                    conc_key = level
                    break
            
            if conc_key is None:
                continue
            
            concentration = conc_key.get("concentration", 0.0)
            peak_area = injection.peak_data.get(compound_name, 0.0)
            is_area = injection.internal_standard_area.get(
                internal_standard,
                injection.peak_data.get(internal_standard, 0.0)
            )
            
            if is_area > 0:
                ratio = peak_area / is_area
            else:
                ratio = 0.0
            
            point = CalibrationPoint(
                concentration=concentration,
                peak_area=peak_area,
                internal_standard_area=is_area,
                ratio=ratio,
                injection_index=idx,
            )
            calibration_points.append(point)
        
        calibration_points.sort(key=lambda p: p.concentration)
        
        if len(calibration_points) < 3:
            issues.append(QCIssue(
                issue_type=QCIssueType.CALIBRATION_FAILED,
                severity="critical",
                sample_ids=[c.sample_id for c in calibrators],
                description=f"化合物 {compound_name} 校准点不足（仅有 {len(calibration_points)} 个）",
                details={"compound": compound_name, "num_points": len(calibration_points)},
            ))
            continue
        
        x = [p.concentration for p in calibration_points]
        y = [p.ratio for p in calibration_points]
        
        slope, intercept, r_squared = linear_regression(x, y)
        
        min_r_squared = compound_config.get("min_r_squared", 0.99)
        if r_squared < min_r_squared:
            issues.append(QCIssue(
                issue_type=QCIssueType.CALIBRATION_FAILED,
                severity="high",
                sample_ids=[c.sample_id for c in calibrators],
                description=f"化合物 {compound_name} 校准曲线 R² 过低: {r_squared:.4f} < {min_r_squared}",
                details={"compound": compound_name, "r_squared": r_squared, "min_required": min_r_squared},
            ))
        
        lod = calculate_lod(calibration_points, slope)
        loq = calculate_loq(calibration_points, slope)
        
        curve = CalibrationCurve(
            compound=compound_name,
            internal_standard=internal_standard,
            slope=slope,
            intercept=intercept,
            r_squared=r_squared,
            points=calibration_points,
            lod=lod,
            loq=loq,
        )
        
        calibration_curves[compound_name] = curve
    
    batch_data.qc_issues.extend(issues)
    return calibration_curves


def calculate_concentration(
    peak_area: float,
    internal_standard_area: float,
    calibration_curve: CalibrationCurve,
) -> float:
    if internal_standard_area <= 0 or calibration_curve.slope == 0:
        return 0.0
    
    ratio = peak_area / internal_standard_area
    concentration = (ratio - calibration_curve.intercept) / calibration_curve.slope
    
    return max(concentration, 0.0)


def is_above_lod(concentration: float, calibration_curve: CalibrationCurve) -> bool:
    return concentration >= calibration_curve.lod and calibration_curve.lod > 0


def is_above_loq(concentration: float, calibration_curve: CalibrationCurve) -> bool:
    return concentration >= calibration_curve.loq and calibration_curve.loq > 0

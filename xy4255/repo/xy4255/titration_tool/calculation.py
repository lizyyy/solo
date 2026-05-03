"""数值计算模块 - 平滑、等当点识别、离群点检测"""

import copy
from typing import List, Optional, Tuple, Dict, Any
import numpy as np

from .models import (
    TitrationPoint,
    TitrationCurve,
    EquivalencePoint,
    FitResult,
    AnalysisParams,
    DataQuality,
    SampleType,
)


def savitzky_golay(y: np.ndarray, window_size: int, polyorder: int) -> np.ndarray:
    """
    Savitzky-Golay平滑滤波器
    
    Args:
        y: 输入数据数组
        window_size: 窗口大小（必须为奇数）
        polyorder: 拟合多项式阶数
    
    Returns:
        平滑后的数据数组
    """
    if window_size % 2 == 0:
        window_size += 1
    
    if window_size < polyorder + 2:
        window_size = polyorder + 2
        if window_size % 2 == 0:
            window_size += 1
    
    half_window = (window_size - 1) // 2
    n = len(y)
    
    if n < window_size:
        return y.copy()
    
    y_padded = np.concatenate([
        y[0] * np.ones(half_window),
        y,
        y[-1] * np.ones(half_window)
    ])
    
    order_range = range(polyorder + 1)
    k = np.arange(-half_window, half_window + 1)
    b = np.mat([[ki ** j for j in order_range] for ki in k])
    
    m = np.linalg.pinv(b).A[0]
    
    smoothed = np.convolve(m[::-1], y_padded, mode='valid')
    
    return smoothed


def calculate_derivative(x: np.ndarray, y: np.ndarray, order: int = 1) -> np.ndarray:
    """
    计算导数（使用中心差分法）
    
    Args:
        x: 自变量数组
        y: 因变量数组
        order: 导数阶数（1或2）
    
    Returns:
        导数数组
    """
    n = len(y)
    if n < 3:
        return np.zeros(n)
    
    if order == 1:
        dy = np.zeros(n)
        dy[0] = (y[1] - y[0]) / (x[1] - x[0]) if x[1] != x[0] else 0
        dy[-1] = (y[-1] - y[-2]) / (x[-1] - x[-2]) if x[-1] != x[-2] else 0
        
        for i in range(1, n - 1):
            dx = x[i + 1] - x[i - 1]
            if dx != 0:
                dy[i] = (y[i + 1] - y[i - 1]) / dx
            else:
                dy[i] = dy[i - 1]
        return dy
    
    elif order == 2:
        d2y = np.zeros(n)
        for i in range(1, n - 1):
            h1 = x[i] - x[i - 1]
            h2 = x[i + 1] - x[i]
            if h1 > 0 and h2 > 0:
                h_avg = (h1 + h2) / 2
                d2y[i] = (y[i + 1] - 2 * y[i] + y[i - 1]) / (h_avg ** 2)
            else:
                d2y[i] = d2y[i - 1] if i > 0 else 0
        d2y[0] = d2y[1] if n > 1 else 0
        d2y[-1] = d2y[-2] if n > 1 else 0
        return d2y
    
    return np.zeros(n)


def find_equivalence_points_first_derivative(
    x: np.ndarray, 
    y: np.ndarray, 
    threshold: float = 0.1
) -> List[EquivalencePoint]:
    """
    使用一阶导数法找等当点
    等当点处一阶导数绝对值最大（pH变化最快）
    
    Args:
        x: 体积数组
        y: pH数组
        threshold: 导数阈值
    
    Returns:
        等当点列表
    """
    dy = calculate_derivative(x, y, order=1)
    abs_dy = np.abs(dy)
    
    equivalence_points = []
    
    peaks = []
    n = len(abs_dy)
    for i in range(1, n - 1):
        if abs_dy[i] > abs_dy[i - 1] and abs_dy[i] > abs_dy[i + 1]:
            if abs_dy[i] > threshold:
                peaks.append((i, abs_dy[i], x[i], y[i]))
    
    peaks.sort(key=lambda p: p[1], reverse=True)
    
    max_derivative = peaks[0][1] if peaks else 1.0
    
    for idx, deriv_val, vol, ph in peaks:
        confidence = min(1.0, deriv_val / max_derivative)
        ep = EquivalencePoint(
            volume=vol,
            ph=ph,
            method="first_derivative",
            index=idx,
            derivative_value=deriv_val,
            confidence=confidence,
        )
        equivalence_points.append(ep)
    
    return equivalence_points


def find_equivalence_points_second_derivative(
    x: np.ndarray, 
    y: np.ndarray, 
    threshold: float = 0.1
) -> List[EquivalencePoint]:
    """
    使用二阶导数法找等当点
    等当点处二阶导数过零点（从正变负或从负变正）
    
    Args:
        x: 体积数组
        y: pH数组
        threshold: 二阶导数变化阈值
    
    Returns:
        等当点列表
    """
    d2y = calculate_derivative(x, y, order=2)
    
    equivalence_points = []
    
    n = len(d2y)
    crossings = []
    
    for i in range(1, n):
        if (d2y[i-1] > 0 and d2y[i] < 0) or (d2y[i-1] < 0 and d2y[i] > 0):
            if abs(d2y[i] - d2y[i-1]) > threshold:
                alpha = -d2y[i-1] / (d2y[i] - d2y[i-1]) if (d2y[i] - d2y[i-1]) != 0 else 0.5
                vol_interp = x[i-1] + alpha * (x[i] - x[i-1])
                ph_interp = y[i-1] + alpha * (y[i] - y[i-1])
                deriv_magnitude = abs(d2y[i] - d2y[i-1]) / (x[i] - x[i-1]) if (x[i] - x[i-1]) != 0 else abs(d2y[i] - d2y[i-1])
                
                crossings.append((i, deriv_magnitude, vol_interp, ph_interp))
    
    crossings.sort(key=lambda c: c[1], reverse=True)
    
    max_deriv = crossings[0][1] if crossings else 1.0
    
    for idx, deriv_mag, vol, ph in crossings:
        confidence = min(1.0, deriv_mag / max_deriv) if max_deriv > 0 else 0.5
        ep = EquivalencePoint(
            volume=vol,
            ph=ph,
            method="second_derivative",
            index=idx,
            derivative_value=deriv_mag,
            confidence=confidence,
        )
        equivalence_points.append(ep)
    
    return equivalence_points


def find_equivalence_points(
    x: np.ndarray, 
    y: np.ndarray, 
    method: str = "second_derivative",
    threshold: float = 0.1
) -> List[EquivalencePoint]:
    """
    找等当点的统一接口
    
    Args:
        x: 体积数组
        y: pH数组
        method: 方法名称（"first_derivative" 或 "second_derivative"）
        threshold: 检测阈值
    
    Returns:
        等当点列表
    """
    if method == "first_derivative":
        return find_equivalence_points_first_derivative(x, y, threshold)
    else:
        return find_equivalence_points_second_derivative(x, y, threshold)


def detect_outliers_iqr(
    y: np.ndarray,
    iqr_factor: float = 1.5
) -> List[int]:
    """
    使用IQR方法检测离群点
    
    Args:
        y: 数据数组
        iqr_factor: IQR因子（通常为1.5）
    
    Returns:
        离群点索引列表
    """
    n = len(y)
    if n < 4:
        return []
    
    q1 = np.percentile(y, 25)
    q3 = np.percentile(y, 75)
    iqr = q3 - q1
    
    lower_bound = q1 - iqr_factor * iqr
    upper_bound = q3 + iqr_factor * iqr
    
    outliers = []
    for i, val in enumerate(y):
        if val < lower_bound or val > upper_bound:
            outliers.append(i)
    
    return outliers


def detect_outliers_derivative(
    x: np.ndarray,
    y: np.ndarray,
    threshold_factor: float = 3.0
) -> List[int]:
    """
    使用导数突变检测离群点
    
    Args:
        x: 体积数组
        y: pH数组
        threshold_factor: 阈值因子
    
    Returns:
        离群点索引列表
    """
    n = len(y)
    if n < 4:
        return []
    
    dy = calculate_derivative(x, y, order=1)
    abs_dy = np.abs(dy)
    
    median_abs_dy = np.median(abs_dy)
    mad = np.median(np.abs(abs_dy - median_abs_dy))
    
    threshold = median_abs_dy + threshold_factor * mad
    
    outliers = []
    for i in range(1, n - 1):
        if abs_dy[i] > threshold:
            outliers.append(i)
    
    return outliers


def smooth_curve(
    curve: TitrationCurve,
    window_size: int = 5,
    polyorder: int = 2
) -> TitrationCurve:
    """
    平滑滴定曲线
    
    Args:
        curve: 原始滴定曲线
        window_size: 平滑窗口大小
        polyorder: 多项式阶数
    
    Returns:
        平滑后的滴定曲线
    """
    if len(curve.points) < window_size:
        return copy.deepcopy(curve)
    
    x = np.array([p.volume for p in curve.points])
    y = np.array([p.ph for p in curve.points])
    
    y_smoothed = savitzky_golay(y, window_size, polyorder)
    
    smoothed_points = []
    for i, (orig_point, smooth_ph) in enumerate(zip(curve.points, y_smoothed)):
        smoothed_point = TitrationPoint(
            volume=orig_point.volume,
            ph=float(smooth_ph),
            temperature=orig_point.temperature,
            index=i,
            is_outlier=orig_point.is_outlier,
            outlier_reason=orig_point.outlier_reason,
        )
        smoothed_points.append(smoothed_point)
    
    smoothed_curve = TitrationCurve(
        sample_id=curve.sample_id,
        sample_type=curve.sample_type,
        points=smoothed_points,
        temperature=curve.temperature,
        source_file=curve.source_file,
    )
    
    return smoothed_curve


def apply_blank_correction(
    curve: TitrationCurve,
    blank_curve: TitrationCurve
) -> Tuple[TitrationCurve, float]:
    """
    应用空白校正
    
    Args:
        curve: 样品滴定曲线
        blank_curve: 空白滴定曲线
    
    Returns:
        (校正后的曲线, 空白体积校正值)
    """
    if len(blank_curve.points) < 3:
        return copy.deepcopy(curve), 0.0
    
    blank_x = np.array([p.volume for p in blank_curve.points])
    blank_y = np.array([p.ph for p in blank_curve.points])
    
    blank_eps = find_equivalence_points(blank_x, blank_y, method="second_derivative")
    
    blank_volume = 0.0
    if blank_eps:
        blank_volume = blank_eps[0].volume
    
    corrected_curve = copy.deepcopy(curve)
    
    return corrected_curve, blank_volume


def analyze_titration_curve(
    curve: TitrationCurve,
    params: AnalysisParams,
    blank_curve: Optional[TitrationCurve] = None,
) -> FitResult:
    """
    完整的滴定曲线分析流程
    
    Args:
        curve: 原始滴定曲线
        params: 分析参数
        blank_curve: 空白滴定曲线（可选）
    
    Returns:
        拟合分析结果
    """
    result = FitResult(
        sample_id=curve.sample_id,
        original_curve=curve,
        warnings=[],
    )
    
    working_curve = copy.deepcopy(curve)
    
    if blank_curve and params.blank_correction_enabled:
        working_curve, blank_vol = apply_blank_correction(working_curve, blank_curve)
        result.blank_corrected = True
        result.blank_volume = blank_vol
        if blank_vol > 0:
            result.warnings.append(f"已应用空白校正，空白体积: {blank_vol:.4f} mL")
    
    try:
        smoothed_curve = smooth_curve(
            working_curve,
            window_size=params.smoothing_window,
            polyorder=params.smoothing_polyorder,
        )
        result.smoothed_curve = smoothed_curve
    except Exception as e:
        result.warnings.append(f"平滑处理失败: {str(e)}，使用原始数据")
        smoothed_curve = working_curve
    
    x = np.array([p.volume for p in smoothed_curve.points])
    y = np.array([p.ph for p in smoothed_curve.points])
    
    try:
        eps = find_equivalence_points(
            x, y,
            method=params.equivalence_point_method,
            threshold=params.derivative_threshold,
        )
        result.equivalence_points = eps
        
        if eps:
            result.primary_equivalence = max(eps, key=lambda ep: ep.confidence)
        else:
            result.warnings.append("未检测到明确的等当点")
            result.quality = DataQuality.SUSPECT
    except Exception as e:
        result.warnings.append(f"等当点检测失败: {str(e)}")
        result.quality = DataQuality.BAD
    
    try:
        outliers_iqr = detect_outliers_iqr(y, iqr_factor=params.outlier_iqr_factor)
        outliers_deriv = detect_outliers_derivative(x, y)
        
        all_outliers = set(outliers_iqr) | set(outliers_deriv)
        result.outliers = sorted(list(all_outliers))
        result.outlier_count = len(result.outliers)
        
        for idx in result.outliers:
            if idx < len(working_curve.points):
                working_curve.points[idx].is_outlier = True
                reason = "IQR检测异常"
                if idx in outliers_deriv:
                    reason = "导数突变异常"
                if idx in outliers_iqr and idx in outliers_deriv:
                    reason = "多重检测异常"
                working_curve.points[idx].outlier_reason = reason
        
        if result.outlier_count > 0:
            result.warnings.append(f"检测到 {result.outlier_count} 个离群点")
            if result.outlier_count > len(working_curve.points) * 0.2:
                result.quality = DataQuality.SUSPECT
                result.warnings.append("离群点比例超过20%，数据质量可疑")
    except Exception as e:
        result.warnings.append(f"离群点检测失败: {str(e)}")
    
    try:
        ph_values = [p.ph for p in working_curve.points if not p.is_outlier]
        volumes = [p.volume for p in working_curve.points if not p.is_outlier]
        
        if ph_values:
            result.statistics = {
                'total_points': len(working_curve.points),
                'valid_points': len(ph_values),
                'outlier_count': result.outlier_count,
                'ph_mean': float(np.mean(ph_values)),
                'ph_std': float(np.std(ph_values)),
                'ph_min': float(np.min(ph_values)),
                'ph_max': float(np.max(ph_values)),
                'volume_start': volumes[0] if volumes else None,
                'volume_end': volumes[-1] if volumes else None,
                'volume_range': volumes[-1] - volumes[0] if volumes else None,
            }
    except Exception as e:
        result.warnings.append(f"统计计算失败: {str(e)}")
    
    if result.primary_equivalence is None and result.equivalence_points:
        result.primary_equivalence = result.equivalence_points[0]
    
    if result.quality == DataQuality.GOOD:
        if not result.primary_equivalence:
            result.quality = DataQuality.SUSPECT
        elif result.outlier_count > len(working_curve.points) * 0.3:
            result.quality = DataQuality.SUSPECT
    
    return result


def calculate_statistics(fit_results: List[FitResult]) -> Dict[str, Any]:
    """
    计算多个拟合结果的统计汇总
    
    Args:
        fit_results: 拟合结果列表
    
    Returns:
        统计摘要字典
    """
    if not fit_results:
        return {}
    
    ep_volumes = []
    ep_phs = []
    outlier_counts = []
    quality_counts = {'good': 0, 'suspect': 0, 'bad': 0}
    
    for result in fit_results:
        outlier_counts.append(result.outlier_count)
        quality_counts[result.quality.value] += 1
        
        if result.primary_equivalence:
            ep_volumes.append(result.primary_equivalence.volume)
            ep_phs.append(result.primary_equivalence.ph)
    
    stats = {
        'total_samples': len(fit_results),
        'quality_distribution': quality_counts,
    }
    
    if ep_volumes:
        stats['equivalence_point'] = {
            'volume_mean': float(np.mean(ep_volumes)),
            'volume_std': float(np.std(ep_volumes)),
            'volume_median': float(np.median(ep_volumes)),
            'volume_min': float(np.min(ep_volumes)),
            'volume_max': float(np.max(ep_volumes)),
            'ph_mean': float(np.mean(ep_phs)),
            'ph_std': float(np.std(ep_phs)),
            'count': len(ep_volumes),
        }
    
    if outlier_counts:
        stats['outliers'] = {
            'mean': float(np.mean(outlier_counts)),
            'total': int(np.sum(outlier_counts)),
        }
    
    return stats

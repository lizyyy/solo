import numpy as np
from typing import List, Dict, Any, Tuple, Optional
from datetime import datetime

from models import (
    MeasurementMethod, Status, CalibrationResult,
    JudgmentTrail, AnomalyMark, AnomalyType
)
from anomaly_detector import run_all_anomaly_detections


def calculate_theoretical_velocity(temperature: float) -> float:
    return 331.45 + 0.6 * temperature


def progressive_difference_method(values: np.ndarray, group_size: int = 6) -> Tuple[float, float, List[JudgmentTrail]]:
    trails = []

    n = len(values)
    if n < group_size * 2:
        trails.append(JudgmentTrail(
            timestamp=datetime.now().isoformat(timespec="seconds"),
            criterion="逐差法数据量检查",
            reason=f"数据点数量({n})不足，需要至少{group_size * 2}个点才能进行逐差法",
            result="数据量不足，无法使用逐差法，改用简单平均"
        ))
        return np.mean(np.diff(values)), np.std(np.diff(values)), trails

    trails.append(JudgmentTrail(
        timestamp=datetime.now().isoformat(timespec="seconds"),
        criterion="逐差法数据分组",
        reason=f"共{n}个数据点，分为前后两组各{group_size}个点",
        result=f"分组完成，准备计算逐差"
    ))

    diffs = []
    for i in range(group_size):
        diff = values[i + group_size] - values[i]
        diffs.append(diff)
        trails.append(JudgmentTrail(
            timestamp=datetime.now().isoformat(timespec="seconds"),
            criterion=f"逐差计算第{i+1}组",
            reason=f"第{i+group_size+1}个点({values[i+group_size]:.4f}) - 第{i+1}个点({values[i]:.4f})",
            result=f"逐差值 = {diff:.4f}"
        ))

    avg_diff = np.mean(diffs) / group_size
    std_diff = np.std(diffs) / group_size

    trails.append(JudgmentTrail(
        timestamp=datetime.now().isoformat(timespec="seconds"),
        criterion="逐差法结果计算",
        reason=f"逐差值列表: {[round(d, 4) for d in diffs]}",
        result=f"平均波长/2 = {avg_diff:.6f}, 标准差 = {std_diff:.6f}"
    ))

    return avg_diff, std_diff, trails


def standing_wave_calibration(
    data: List[Dict[str, Any]],
    frequency: float,
    temperature: float,
    position_unit: str = "mm"
) -> Tuple[CalibrationResult, Dict[str, Any]]:
    all_trails = []
    all_anomalies = []

    all_trails.append(JudgmentTrail(
        timestamp=datetime.now().isoformat(timespec="seconds"),
        criterion="校准方法选择",
        reason="使用驻波法（共振干涉法）进行声速测量",
        result="方法: 驻波法"
    ))

    unit_conversion = 1.0
    if position_unit == "mm":
        unit_conversion = 0.001
    elif position_unit == "cm":
        unit_conversion = 0.01

    all_trails.append(JudgmentTrail(
        timestamp=datetime.now().isoformat(timespec="seconds"),
        criterion="单位换算确认",
        reason=f"输入位置单位为{position_unit}，换算系数为{unit_conversion}",
        result=f"1 {position_unit} = {unit_conversion} m"
    ))

    anomalies, anomaly_stats = run_all_anomaly_detections(data, method="驻波法")
    all_anomalies.extend(anomalies)

    for anomaly in anomalies:
        all_trails.append(JudgmentTrail(
            timestamp=datetime.now().isoformat(timespec="seconds"),
            criterion=f"异常检测 - {anomaly.anomaly_type.value}",
            reason=anomaly.description,
            result=f"标记为{anomaly.severity}级异常，位置: {anomaly.position}"
        ))

    positions = np.array([d["position"] for d in data]) * unit_conversion
    amplitudes = np.array([d["amplitude"] for d in data])

    all_trails.append(JudgmentTrail(
        timestamp=datetime.now().isoformat(timespec="seconds"),
        criterion="波峰检测算法",
        reason="通过振幅阈值（均值的80%）识别共振峰位置",
        result=f"振幅范围: {np.min(amplitudes):.2f} - {np.max(amplitudes):.2f}, 均值: {np.mean(amplitudes):.2f}"
    ))

    peak_indices = np.where(amplitudes > np.mean(amplitudes) * 0.8)[0]

    if len(peak_indices) < 6:
        all_trails.append(JudgmentTrail(
            timestamp=datetime.now().isoformat(timespec="seconds"),
            criterion="波峰数量检查",
            reason=f"仅检测到{len(peak_indices)}个波峰，需要至少6个进行逐差法",
            result="波峰数量不足，尝试使用所有数据点"
        ))
        peak_indices = np.arange(len(positions))

    peak_positions = positions[peak_indices]

    all_trails.append(JudgmentTrail(
        timestamp=datetime.now().isoformat(timespec="seconds"),
        criterion="波峰位置提取",
        reason=f"从{len(peak_indices)}个波峰中提取位置数据",
        result=f"波峰位置(m): {[round(p, 6) for p in peak_positions]}"
    ))

    half_wavelength, wavelength_std, diff_trails = progressive_difference_method(peak_positions)
    all_trails.extend(diff_trails)

    wavelength = half_wavelength * 2

    all_trails.append(JudgmentTrail(
        timestamp=datetime.now().isoformat(timespec="seconds"),
        criterion="波长计算",
        reason=f"逐差法得到半波长 = {half_wavelength:.6f} m",
        result=f"波长 λ = {half_wavelength} × 2 = {wavelength:.6f} m"
    ))

    measured_velocity = frequency * wavelength

    all_trails.append(JudgmentTrail(
        timestamp=datetime.now().isoformat(timespec="seconds"),
        criterion="声速计算",
        reason=f"v = f × λ = {frequency} Hz × {wavelength:.6f} m",
        result=f"测量声速 v = {measured_velocity:.2f} m/s"
    ))

    theoretical_velocity = calculate_theoretical_velocity(temperature)

    all_trails.append(JudgmentTrail(
        timestamp=datetime.now().isoformat(timespec="seconds"),
        criterion="理论声速计算",
        reason=f"v理论 = 331.45 + 0.6 × T = 331.45 + 0.6 × {temperature}",
        result=f"理论声速 v理论 = {theoretical_velocity:.2f} m/s"
    ))

    relative_error = abs(measured_velocity - theoretical_velocity) / theoretical_velocity * 100

    all_trails.append(JudgmentTrail(
        timestamp=datetime.now().isoformat(timespec="seconds"),
        criterion="相对误差计算",
        reason=f"|{measured_velocity:.2f} - {theoretical_velocity:.2f}| / {theoretical_velocity:.2f} × 100%",
        result=f"相对误差 = {relative_error:.2f}%"
    ))

    status = determine_status(all_anomalies, relative_error, all_trails)

    result = CalibrationResult(
        method=MeasurementMethod.STANDING_WAVE,
        measured_velocity=measured_velocity,
        theoretical_velocity=theoretical_velocity,
        relative_error=relative_error,
        temperature=temperature,
        frequency=frequency,
        wavelength=wavelength,
        judgment_trails=all_trails,
        anomalies=all_anomalies,
        status=status
    )

    extra_info = {
        "peak_count": len(peak_indices),
        "half_wavelength": half_wavelength,
        "wavelength_std": wavelength_std,
        "anomaly_stats": anomaly_stats
    }

    return result, extra_info


def phase_comparison_calibration(
    data: List[Dict[str, Any]],
    frequency: float,
    temperature: float,
    position_unit: str = "mm"
) -> Tuple[CalibrationResult, Dict[str, Any]]:
    all_trails = []
    all_anomalies = []

    all_trails.append(JudgmentTrail(
        timestamp=datetime.now().isoformat(timespec="seconds"),
        criterion="校准方法选择",
        reason="使用相位比较法（行波法）进行声速测量",
        result="方法: 相位比较法"
    ))

    unit_conversion = 1.0
    if position_unit == "mm":
        unit_conversion = 0.001
    elif position_unit == "cm":
        unit_conversion = 0.01

    all_trails.append(JudgmentTrail(
        timestamp=datetime.now().isoformat(timespec="seconds"),
        criterion="单位换算确认",
        reason=f"输入位置单位为{position_unit}，换算系数为{unit_conversion}",
        result=f"1 {position_unit} = {unit_conversion} m"
    ))

    anomalies, anomaly_stats = run_all_anomaly_detections(data, method="相位比较法")
    all_anomalies.extend(anomalies)

    for anomaly in anomalies:
        all_trails.append(JudgmentTrail(
            timestamp=datetime.now().isoformat(timespec="seconds"),
            criterion=f"异常检测 - {anomaly.anomaly_type.value}",
            reason=anomaly.description,
            result=f"标记为{anomaly.severity}级异常，位置: {anomaly.position}"
        ))

    positions = np.array([d["position"] for d in data]) * unit_conversion
    phases = np.array([d["phase"] for d in data])

    all_trails.append(JudgmentTrail(
        timestamp=datetime.now().isoformat(timespec="seconds"),
        criterion="同相点检测",
        reason="通过相位值相同的点（相位差为360°的整数倍）识别同相点位置",
        result=f"相位范围: {np.min(phases):.1f}° - {np.max(phases):.1f}°"
    ))

    phases_mod = np.mod(phases, 360)

    crossing_indices = []
    phase_groups = {}
    for i, ph in enumerate(phases_mod):
        ph_rounded = round(ph / 10) * 10
        if ph_rounded not in phase_groups:
            phase_groups[ph_rounded] = []
        phase_groups[ph_rounded].append(i)

    max_group = max(phase_groups.values(), key=len) if phase_groups else []
    if len(max_group) >= 6:
        crossing_indices = np.array(sorted(max_group))
        all_trails.append(JudgmentTrail(
            timestamp=datetime.now().isoformat(timespec="seconds"),
            criterion="同相点分组检测",
            reason=f"检测到{len(max_group)}个相位约为{round(phases_mod[max_group[0]])}°的同相点",
            result=f"使用相位分组法，找到{len(crossing_indices)}个同相点"
        ))
    else:
        phase_diffs = np.abs(np.diff(phases_mod))
        crossing_indices = np.where((phase_diffs >= 170) & (phase_diffs <= 190))[0]

        if len(crossing_indices) < 6:
            crossing_indices = np.where(phase_diffs > 180)[0]

        if len(crossing_indices) < 6:
            all_trails.append(JudgmentTrail(
                timestamp=datetime.now().isoformat(timespec="seconds"),
                criterion="同相点数量检查",
                reason=f"仅检测到{len(crossing_indices)}个同相点，需要至少6个进行逐差法",
                result="同相点数量不足，尝试使用所有数据点"
            ))
            crossing_indices = np.arange(len(positions) - 1)

    crossing_positions = positions[crossing_indices]

    all_trails.append(JudgmentTrail(
        timestamp=datetime.now().isoformat(timespec="seconds"),
        criterion="过零点位置提取",
        reason=f"从{len(crossing_indices)}个过零点中提取位置数据",
        result=f"过零点位置(m): {[round(p, 6) for p in crossing_positions]}"
    ))

    wavelength, wavelength_std, diff_trails = progressive_difference_method(crossing_positions)
    all_trails.extend(diff_trails)

    all_trails.append(JudgmentTrail(
        timestamp=datetime.now().isoformat(timespec="seconds"),
        criterion="波长计算",
        reason=f"相位比较法中，相邻同相点间距等于一个波长",
        result=f"波长 λ = {wavelength:.6f} m"
    ))

    measured_velocity = frequency * wavelength

    all_trails.append(JudgmentTrail(
        timestamp=datetime.now().isoformat(timespec="seconds"),
        criterion="声速计算",
        reason=f"v = f × λ = {frequency} Hz × {wavelength:.6f} m",
        result=f"测量声速 v = {measured_velocity:.2f} m/s"
    ))

    theoretical_velocity = calculate_theoretical_velocity(temperature)

    all_trails.append(JudgmentTrail(
        timestamp=datetime.now().isoformat(timespec="seconds"),
        criterion="理论声速计算",
        reason=f"v理论 = 331.45 + 0.6 × T = 331.45 + 0.6 × {temperature}",
        result=f"理论声速 v理论 = {theoretical_velocity:.2f} m/s"
    ))

    relative_error = abs(measured_velocity - theoretical_velocity) / theoretical_velocity * 100

    all_trails.append(JudgmentTrail(
        timestamp=datetime.now().isoformat(timespec="seconds"),
        criterion="相对误差计算",
        reason=f"|{measured_velocity:.2f} - {theoretical_velocity:.2f}| / {theoretical_velocity:.2f} × 100%",
        result=f"相对误差 = {relative_error:.2f}%"
    ))

    status = determine_status(all_anomalies, relative_error, all_trails)

    result = CalibrationResult(
        method=MeasurementMethod.PHASE_COMPARISON,
        measured_velocity=measured_velocity,
        theoretical_velocity=theoretical_velocity,
        relative_error=relative_error,
        temperature=temperature,
        frequency=frequency,
        wavelength=wavelength,
        judgment_trails=all_trails,
        anomalies=all_anomalies,
        status=status
    )

    extra_info = {
        "crossing_count": len(crossing_indices),
        "wavelength_std": wavelength_std,
        "anomaly_stats": anomaly_stats
    }

    return result, extra_info


def determine_status(
    anomalies: List[AnomalyMark],
    relative_error: float,
    trails: List[JudgmentTrail]
) -> Status:
    timestamp = datetime.now().isoformat(timespec="seconds")

    critical_anomaly_types = {AnomalyType.SAMPLING_GAP, AnomalyType.UNIT_CONVERSION_ERROR}
    critical_anomalies = [a for a in anomalies if a.anomaly_type in critical_anomaly_types]

    if critical_anomalies:
        trails.append(JudgmentTrail(
            timestamp=timestamp,
            criterion="最终状态判定 - 严重异常检查",
            reason=f"检测到{len(critical_anomalies)}个严重异常: {[a.anomaly_type.value for a in critical_anomalies]}",
            result="状态标记为【待确认】，存在采样缺口或单位换算错误等严重问题"
        ))
        return Status.PENDING

    drift_anomalies = [a for a in anomalies if a.anomaly_type == AnomalyType.ZERO_DRIFT]
    if drift_anomalies:
        trails.append(JudgmentTrail(
            timestamp=timestamp,
            criterion="最终状态判定 - 零点漂移检查",
            reason=f"检测到{len(drift_anomalies)}个零点漂移异常",
            result="状态标记为【待确认】，零点漂移可能影响结果准确性"
        ))
        return Status.PENDING

    if relative_error > 5.0:
        trails.append(JudgmentTrail(
            timestamp=timestamp,
            criterion="最终状态判定 - 误差阈值检查",
            reason=f"相对误差{relative_error:.2f}%超过5%阈值",
            result="状态标记为【待确认】，误差超出正常范围"
        ))
        return Status.PENDING

    if relative_error > 2.0:
        trails.append(JudgmentTrail(
            timestamp=timestamp,
            criterion="最终状态判定 - 误差范围检查",
            reason=f"相对误差{relative_error:.2f}%在2%-5%之间",
            result="状态标记为【正常】，但误差偏大，建议复核"
        ))
        return Status.NORMAL

    trails.append(JudgmentTrail(
        timestamp=timestamp,
        criterion="最终状态判定 - 所有检查通过",
        reason=f"无严重异常，相对误差{relative_error:.2f}%<2%",
        result="状态标记为【正常】"
    ))
    return Status.NORMAL


def run_full_calibration(
    data: List[Dict[str, Any]],
    frequency: float,
    temperature: float,
    position_unit: str = "mm",
    methods: Optional[List[MeasurementMethod]] = None
) -> List[CalibrationResult]:
    if methods is None:
        methods = [MeasurementMethod.STANDING_WAVE, MeasurementMethod.PHASE_COMPARISON]

    results = []

    for method in methods:
        if method == MeasurementMethod.STANDING_WAVE:
            result, _ = standing_wave_calibration(data, frequency, temperature, position_unit)
        elif method == MeasurementMethod.PHASE_COMPARISON:
            result, _ = phase_comparison_calibration(data, frequency, temperature, position_unit)
        else:
            continue

        results.append(result)

    return results

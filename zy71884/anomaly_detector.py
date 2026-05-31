import numpy as np
from typing import List, Dict, Any, Tuple
from collections import defaultdict

from models import AnomalyMark, AnomalyType


def detect_sampling_gaps(
    data: List[Dict[str, Any]],
    threshold_ratio: float = 3.0
) -> List[AnomalyMark]:
    anomalies = []

    if len(data) < 3:
        return anomalies

    timestamps = [d["timestamp"] for d in data]
    intervals = np.diff(timestamps)

    if len(intervals) == 0:
        return anomalies

    median_interval = np.median(intervals)
    mean_interval = np.mean(intervals)

    if median_interval == 0:
        return anomalies

    for i, interval in enumerate(intervals):
        if interval > median_interval * threshold_ratio:
            gap_start = timestamps[i]
            gap_end = timestamps[i + 1]
            gap_size = interval
            expected = median_interval

            anomalies.append(AnomalyMark(
                anomaly_type=AnomalyType.SAMPLING_GAP,
                description=(
                    f"检测到采样缺口：第{i + 1}个采样点({gap_start}s)到第{i + 2}个采样点({gap_end}s) "
                    f"时间间隔为{gap_size:.2f}s，预期约{expected:.2f}s，超出{threshold_ratio}倍"
                ),
                position=f"采样点索引{i + 1}-{i + 2}",
                severity="high"
            ))

    return anomalies


def detect_unit_conversion_errors(
    data: List[Dict[str, Any]],
    position_unit: str = "mm"
) -> List[AnomalyMark]:
    anomalies = []

    if len(data) < 4:
        return anomalies

    positions = np.array([d["position"] for d in data])

    if len(positions) < 2:
        return anomalies

    diffs = np.diff(positions)

    if len(diffs) == 0:
        return anomalies

    median_diff = np.median(np.abs(diffs))

    if median_diff == 0:
        return anomalies

    for i, diff in enumerate(diffs):
        abs_diff = abs(diff)
        if abs_diff > 0:
            ratio_to_median = abs_diff / median_diff
            if ratio_to_median > 500 or ratio_to_median < 0.002:
                if abs_diff > median_diff * 100:
                    factor = round(abs_diff / median_diff)
                    direction = "放大"
                else:
                    factor = round(median_diff / abs_diff)
                    direction = "缩小"

                anomalies.append(AnomalyMark(
                    anomaly_type=AnomalyType.UNIT_CONVERSION_ERROR,
                    description=(
                        f"疑似单位换算错误：第{i + 1}到{i + 2}个采样点位置变化{diff:.4f}，"
                        f"与周围步长中位数{median_diff:.4f}相比{direction}约{factor}倍。"
                        f"常见错误：mm与m混淆(1000倍)、cm与mm混淆(10倍)"
                    ),
                    position=f"采样点索引{i + 1}-{i + 2}",
                    severity="high"
                ))

    if len(anomalies) == 0:
        pos_diff = np.diff(positions)
        sign_changes = np.sum(np.diff(np.sign(pos_diff)) != 0)
        if sign_changes > len(pos_diff) * 0.3:
            pass

    value_jumps = []
    for i in range(1, len(positions)):
        if positions[i] > 0 and positions[i - 1] > 0:
            ratio = positions[i] / positions[i - 1]
            if ratio > 900 or ratio < 0.0011:
                value_jumps.append((i, ratio))

    for idx, ratio in value_jumps:
        anomalies.append(AnomalyMark(
            anomaly_type=AnomalyType.UNIT_CONVERSION_ERROR,
            description=(
                f"疑似单位换算错误：第{idx}个采样点位置值{positions[idx]:.4f}与"
                f"第{idx + 1}个采样点{positions[idx - 1]:.4f}相比，比值为{ratio:.4f}，"
                f"接近1000倍或1/1000，疑似mm与m单位混淆"
            ),
            position=f"采样点索引{idx}",
            severity="high"
        ))

    return anomalies


def detect_zero_drift(
    data: List[Dict[str, Any]],
    method: str = "驻波法"
) -> List[AnomalyMark]:
    anomalies = []

    if len(data) < 6:
        return anomalies

    positions = np.array([d["position"] for d in data])
    amplitudes = np.array([d["amplitude"] for d in data])
    phases = np.array([d["phase"] for d in data])

    if method == "驻波法":
        peak_indices = np.where(amplitudes > np.mean(amplitudes) * 0.8)[0]

        if len(peak_indices) >= 3:
            peak_positions = positions[peak_indices]
            peak_intervals = np.diff(peak_positions)

            if len(peak_intervals) >= 2:
                expected_interval = np.median(peak_intervals)

                if expected_interval > 0:
                    first_expected_peak = peak_positions[0] - expected_interval
                    if first_expected_peak > 0 and first_expected_peak < positions[0] * 0.1:
                        pass

                    if peak_positions[0] > expected_interval * 0.5:
                        anomalies.append(AnomalyMark(
                            anomaly_type=AnomalyType.ZERO_DRIFT,
                            description=(
                                f"疑似零点漂移：第一个波峰出现在位置{peak_positions[0]:.4f}，"
                                f"而根据后续波峰间距{expected_interval:.4f}推算，"
                                f"零点应在{peak_positions[0] - expected_interval:.4f}附近。"
                                f"可能存在系统偏移或初始位置记录错误"
                            ),
                            position=f"起始位置到第一个波峰",
                            severity="medium"
                        ))

    elif method == "相位比较法":
        phase_crossings = np.where(np.abs(np.diff(np.mod(phases, 360))) > 180)[0]

        if len(phase_crossings) >= 3:
            crossing_positions = positions[phase_crossings]
            crossing_intervals = np.diff(crossing_positions)

            if len(crossing_intervals) >= 2:
                expected_interval = np.median(crossing_intervals)

                if crossing_positions[0] > expected_interval * 0.3:
                    anomalies.append(AnomalyMark(
                        anomaly_type=AnomalyType.ZERO_DRIFT,
                        description=(
                            f"疑似零点漂移：第一个相位过零点出现在位置{crossing_positions[0]:.4f}，"
                            f"而根据后续过零间距{expected_interval:.4f}推算，"
                            f"可能存在{crossing_positions[0]:.4f}的系统偏移"
                        ),
                        position=f"起始位置到第一个相位过零点",
                        severity="medium"
                    ))

    return anomalies


def detect_abnormal_values(data: List[Dict[str, Any]]) -> List[AnomalyMark]:
    anomalies = []

    if len(data) < 4:
        return anomalies

    positions = np.array([d["position"] for d in data])
    amplitudes = np.array([d["amplitude"] for d in data])

    if np.all(amplitudes == amplitudes[0]):
        anomalies.append(AnomalyMark(
            anomaly_type=AnomalyType.ABNORMAL_VALUE,
            description="所有采样点振幅完全相同，疑似数据未正确采集或设备故障",
            position="全部数据",
            severity="high"
        ))

    pos_diffs = np.diff(positions)
    if np.all(pos_diffs == 0):
        anomalies.append(AnomalyMark(
            anomaly_type=AnomalyType.ABNORMAL_VALUE,
            description="换能器位置未发生变化，所有采样点位置相同",
            position="全部数据",
            severity="high"
        ))

    return anomalies


def run_all_anomaly_detections(
    data: List[Dict[str, Any]],
    method: str = "驻波法"
) -> Tuple[List[AnomalyMark], Dict[str, Any]]:
    all_anomalies = []

    gap_anomalies = detect_sampling_gaps(data)
    all_anomalies.extend(gap_anomalies)

    unit_anomalies = detect_unit_conversion_errors(data)
    all_anomalies.extend(unit_anomalies)

    drift_anomalies = detect_zero_drift(data, method)
    all_anomalies.extend(drift_anomalies)

    value_anomalies = detect_abnormal_values(data)
    all_anomalies.extend(value_anomalies)

    stats = {
        "total_samples": len(data),
        "sampling_gaps_detected": len(gap_anomalies),
        "unit_errors_detected": len(unit_anomalies),
        "zero_drifts_detected": len(drift_anomalies),
        "abnormal_values_detected": len(value_anomalies)
    }

    return all_anomalies, stats

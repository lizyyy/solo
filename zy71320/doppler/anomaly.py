from __future__ import annotations

from datetime import datetime

from doppler.models import (
    AnomalyFlag,
    AnomalyType,
    NoiseLabel,
    ProcessingStep,
    RadarSample,
)


_SNR_THRESHOLD_DB = 10.0
_SPEED_SANITY_MIN_KMH = 0.0
_SPEED_SANITY_MAX_KMH = 400.0


def check_noise_peak(
    sample: RadarSample,
) -> AnomalyFlag | None:
    if sample.noise_label == NoiseLabel.PEAK_NOISE:
        return AnomalyFlag(
            anomaly_type=AnomalyType.NOISE_PEAK,
            detail=f"样本 {sample.sample_id} 标记为 peak_noise，测量可信度极低",
            severity="critical",
            suggestion="待确认: 噪声峰数据，建议丢弃或重新采样",
        )
    if sample.noise_label == NoiseLabel.HIGH_NOISE:
        if sample.snr_db is not None and sample.snr_db < _SNR_THRESHOLD_DB:
            return AnomalyFlag(
                anomaly_type=AnomalyType.NOISE_PEAK,
                detail=f"样本 {sample.sample_id} 为 high_noise 且 SNR={sample.snr_db:.1f}dB < {_SNR_THRESHOLD_DB}dB",
                severity="critical",
                suggestion="待确认: 高噪声+低信噪比，建议丢弃或重新采样",
            )
        return AnomalyFlag(
            anomaly_type=AnomalyType.NOISE_PEAK,
            detail=f"样本 {sample.sample_id} 为 high_noise（SNR 未提供或 ≥ {_SNR_THRESHOLD_DB}dB）",
            severity="warning",
            suggestion="待确认: 高噪声数据，请核实信噪比",
        )
    if sample.snr_db is not None and sample.snr_db < _SNR_THRESHOLD_DB:
        return AnomalyFlag(
            anomaly_type=AnomalyType.NOISE_PEAK,
            detail=f"样本 {sample.sample_id} SNR={sample.snr_db:.1f}dB < {_SNR_THRESHOLD_DB}dB",
            severity="warning",
            suggestion="待确认: 信噪比偏低，速度值可能不准",
        )
    return None


def check_lane_mismatch(
    sample: RadarSample,
) -> AnomalyFlag | None:
    if sample.expected_lane is not None and sample.lane_id != sample.expected_lane:
        return AnomalyFlag(
            anomaly_type=AnomalyType.LANE_MISMATCH,
            detail=f"样本 {sample.sample_id} 检测车道={sample.lane_id}，预期车道={sample.expected_lane}",
            severity="warning",
            suggestion="待确认: 车道不一致，可能为跨道车辆或检测错误",
        )
    return None


def check_direction_sign(
    sample: RadarSample,
) -> AnomalyFlag | None:
    shift = sample.frequency_shift_hz
    if sample.direction.value == "approaching" and shift < 0:
        return AnomalyFlag(
            anomaly_type=AnomalyType.DIRECTION_SIGN_REVERSAL,
            detail=f"样本 {sample.sample_id} 方向=approaching 但频移={shift}Hz < 0（应为正值）",
            severity="critical",
            suggestion="待确认: 方向与频移符号矛盾，可能接反或方向标错",
        )
    if sample.direction.value == "receding" and shift > 0:
        return AnomalyFlag(
            anomaly_type=AnomalyType.DIRECTION_SIGN_REVERSAL,
            detail=f"样本 {sample.sample_id} 方向=receding 但频移={shift}Hz > 0（应为负值）",
            severity="critical",
            suggestion="待确认: 方向与频移符号矛盾，可能接反或方向标错",
        )
    return None


def run_anomaly_checks(
    sample: RadarSample,
) -> tuple[list[AnomalyFlag], list[ProcessingStep]]:
    steps: list[ProcessingStep] = []
    now = datetime.now()
    anomalies: list[AnomalyFlag] = []

    step_no = 1

    noise_flag = check_noise_peak(sample)
    steps.append(ProcessingStep(
        step_number=step_no,
        step_name="噪声峰检测",
        description="检查噪声标签与信噪比",
        input_value=f"noise={sample.noise_label.value}, snr={sample.snr_db}",
        output_value="发现噪声峰异常" if noise_flag else "噪声正常",
        timestamp=now,
    ))
    step_no += 1
    if noise_flag:
        anomalies.append(noise_flag)

    lane_flag = check_lane_mismatch(sample)
    steps.append(ProcessingStep(
        step_number=step_no,
        step_name="车道错配检测",
        description="比对检测车道与预期车道",
        input_value=f"lane={sample.lane_id}, expected={sample.expected_lane}",
        output_value="发现车道错配" if lane_flag else "车道匹配",
        timestamp=now,
    ))
    step_no += 1
    if lane_flag:
        anomalies.append(lane_flag)

    direction_flag = check_direction_sign(sample)
    steps.append(ProcessingStep(
        step_number=step_no,
        step_name="方向符号反检测",
        description="比对运动方向与频移符号",
        input_value=f"direction={sample.direction.value}, Δf={sample.frequency_shift_hz}Hz",
        output_value="发现方向符号反转" if direction_flag else "方向符号一致",
        timestamp=now,
    ))
    step_no += 1
    if direction_flag:
        anomalies.append(direction_flag)

    return anomalies, steps


def determine_status(anomalies: list[AnomalyFlag]) -> str:
    if not anomalies:
        return "confirmed"
    for a in anomalies:
        if a.severity == "critical":
            return "rejected"
    return "pending_review"

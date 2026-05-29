from __future__ import annotations

from datetime import datetime
from typing import Optional

from doppler.models import (
    CalibrationParams,
    RadarSample,
    ResultStatus,
    SpeedResult,
)
from doppler.converter import frequency_shift_to_speed
from doppler.anomaly import determine_status, run_anomaly_checks
from doppler.calibration import validate_calibration


def process_sample(
    sample: RadarSample,
    calibration: CalibrationParams,
) -> SpeedResult:
    now = datetime.now()
    all_steps = []

    is_valid, cal_steps = validate_calibration(calibration)
    all_steps.extend(cal_steps)

    if not is_valid:
        return SpeedResult(
            sample_id=sample.sample_id,
            status=ResultStatus.REJECTED,
            anomalies=[],
            processing_steps=all_steps,
            calibration_version=calibration.version,
            processed_at=now,
        )

    try:
        calibrated_speed, conv_steps = frequency_shift_to_speed(
            sample.frequency_shift_hz, calibration
        )
        all_steps.extend(conv_steps)
        raw_speed = calibrated_speed
        speed_kmh = calibrated_speed * 3.6
    except ValueError as e:
        return SpeedResult(
            sample_id=sample.sample_id,
            status=ResultStatus.REJECTED,
            anomalies=[],
            processing_steps=all_steps,
            calibration_version=calibration.version,
            processed_at=now,
        )

    anomalies, anomaly_steps = run_anomaly_checks(sample)
    all_steps.extend(anomaly_steps)

    status_str = determine_status(anomalies)
    status = ResultStatus(status_str)

    return SpeedResult(
        sample_id=sample.sample_id,
        raw_speed_mps=raw_speed,
        calibrated_speed_mps=calibrated_speed,
        speed_kmh=speed_kmh,
        status=status,
        anomalies=anomalies,
        processing_steps=all_steps,
        calibration_version=calibration.version,
        processed_at=now,
    )


def process_batch(
    samples: list[RadarSample],
    calibration: CalibrationParams,
) -> list[SpeedResult]:
    return [process_sample(s, calibration) for s in samples]

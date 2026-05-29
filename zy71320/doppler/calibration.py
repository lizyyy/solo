from __future__ import annotations

from datetime import datetime

from doppler.models import CalibrationParams, ProcessingStep


_DEFAULT_CALIBRATIONS: dict[str, CalibrationParams] = {
    "v1.0": CalibrationParams(
        version="v1.0",
        radar_freq_hz=24150000000.0,
        angle_deg=30.0,
        speed_of_light=299792458.0,
        offset_mps=0.0,
        scale_factor=1.0,
    ),
    "v1.1": CalibrationParams(
        version="v1.1",
        radar_freq_hz=24150000000.0,
        angle_deg=28.5,
        speed_of_light=299792458.0,
        offset_mps=-0.15,
        scale_factor=1.002,
    ),
    "v2.0": CalibrationParams(
        version="v2.0",
        radar_freq_hz=24150000000.0,
        angle_deg=27.0,
        speed_of_light=299792458.0,
        offset_mps=-0.08,
        scale_factor=1.005,
    ),
}


class CalibrationStore:
    def __init__(self) -> None:
        self._store: dict[str, CalibrationParams] = dict(_DEFAULT_CALIBRATIONS)

    def get(self, version: str) -> CalibrationParams | None:
        return self._store.get(version)

    def list_versions(self) -> list[str]:
        return sorted(self._store.keys())

    def register(self, params: CalibrationParams) -> None:
        self._store[params.version] = params


def validate_calibration(
    calibration: CalibrationParams,
) -> tuple[bool, list[ProcessingStep]]:
    steps: list[ProcessingStep] = []
    now = datetime.now()
    valid = True

    if calibration.radar_freq_hz <= 0:
        valid = False
        steps.append(ProcessingStep(
            step_number=1,
            step_name="校准参数校验",
            description="雷达频率必须大于 0",
            input_value=f"radar_freq_hz = {calibration.radar_freq_hz}",
            output_value="校验失败: 雷达频率 ≤ 0",
            timestamp=now,
        ))

    if not (0 <= calibration.angle_deg <= 90):
        valid = False
        steps.append(ProcessingStep(
            step_number=2,
            step_name="校准参数校验",
            description="波束夹角须在 [0°, 90°] 范围",
            input_value=f"angle_deg = {calibration.angle_deg}",
            output_value="校验失败: 角度越界",
            timestamp=now,
        ))

    if calibration.scale_factor <= 0:
        valid = False
        steps.append(ProcessingStep(
            step_number=3,
            step_name="校准参数校验",
            description="缩放因子必须大于 0",
            input_value=f"scale_factor = {calibration.scale_factor}",
            output_value="校验失败: 缩放因子 ≤ 0",
            timestamp=now,
        ))

    if not steps:
        steps.append(ProcessingStep(
            step_number=1,
            step_name="校准参数校验",
            description="所有校准参数均在合法范围",
            input_value=f"版本 {calibration.version}",
            output_value="校验通过",
            timestamp=now,
        ))

    return valid, steps

import re
from datetime import datetime
from typing import List, Tuple, Optional
from models import (
    TemperatureReading, TempUnit, SamplingIntervalSpec,
    ShockDataPoint, ProjectState
)


TEMP_PATTERN = re.compile(
    r'(-?\d+\.?\d*)\s*(°C|℃|K|kelvin|Kelvin|CELSIUS|celsius)',
    re.IGNORECASE
)


def _parse_unit(raw_unit: str) -> TempUnit:
    unit_lower = raw_unit.lower()
    if unit_lower in ['°c', '℃', 'celsius']:
        return TempUnit.CELSIUS
    elif unit_lower in ['k', 'kelvin']:
        return TempUnit.KELVIN
    return TempUnit.UNKNOWN


def parse_sampling_interval(content: str, file_name: str) -> SamplingIntervalSpec:
    readings: List[TemperatureReading] = []
    mixed_points: List[int] = []

    for line_num, line in enumerate(content.split('\n'), 1):
        matches = TEMP_PATTERN.findall(line)
        for match in matches:
            value = float(match[0])
            unit = _parse_unit(match[1])
            readings.append(TemperatureReading(
                timestamp=datetime.now(),
                value=value,
                unit=unit,
                raw_text=f"{match[0]} {match[1]}",
                source_line=line_num
            ))

    units_used = {r.unit for r in readings}
    has_mixed = (TempUnit.CELSIUS in units_used and TempUnit.KELVIN in units_used)

    if has_mixed:
        c_points = [i for i, r in enumerate(readings) if r.unit == TempUnit.CELSIUS]
        k_points = [i for i, r in enumerate(readings) if r.unit == TempUnit.KELVIN]
        mixed_points = sorted(set(c_points + k_points))

    spec = SamplingIntervalSpec(
        file_name=file_name,
        imported_at=datetime.now(),
        raw_content=content,
        readings=readings,
        has_mixed_units=has_mixed,
        mixed_unit_points=mixed_points,
        notes="第一步：采样间隔说明已导入，摄氏度与开尔文混用标记完成，待林老师复核"
    )
    return spec


def detect_mixed_units_in_shock_data(
    shock_data: List[ShockDataPoint],
    spec: SamplingIntervalSpec
) -> List[ShockDataPoint]:
    if not spec.has_mixed_units:
        return shock_data

    for i, point in enumerate(shock_data):
        if i < len(spec.readings):
            reading = spec.readings[i]
            point.temperature_reading = reading
            point.has_mixed_units = i in spec.mixed_unit_points

    return shock_data


def build_clickable_links(state: ProjectState) -> dict:
    links = {}
    for i, point in enumerate(state.shock_data):
        if point.has_mixed_units and point.temperature_reading:
            reading = point.temperature_reading
            links[i] = {
                "data_point_id": i,
                "shock_data": point,
                "sampling_line": reading.source_line,
                "sampling_raw": reading.raw_text,
                "sampling_unit": reading.unit,
                "calibration_id": point.linked_calibration_id,
                "calibration_record": next(
                    (c for c in state.calibration_records
                     if c.record_id == point.linked_calibration_id),
                    None
                ),
                "navigate_to": {
                    "sampling_spec": True,
                    "calibration_records": point.linked_calibration_id is not None
                }
            }
    state.clickable_links = links
    return links


def explain_mixed_units(point_idx: int, state: ProjectState) -> Optional[str]:
    link = state.clickable_links.get(point_idx)
    if not link:
        return None

    reading = link["shock_data"].temperature_reading
    if not reading:
        return None

    unit_name = "摄氏度(°C)" if reading.unit == TempUnit.CELSIUS else "开尔文(K)"
    cal_note = ""
    if link["calibration_record"]:
        cal = link["calibration_record"]
        cal_note = (f"；已关联校准记录{cal.record_id}，"
                    f"林老师于{cal.recorded_at.strftime('%Y-%m-%d')}备注：{cal.remarks}")
    else:
        cal_note = "；尚未关联温度校准记录，待林老师补录"

    return (
        f"【数据点 {point_idx}】温度采样使用{unit_name}（原始记录：{reading.raw_text}），"
        f"与其他数据点单位不一致{cal_note}。"
        f"请训练教练复核，系统未自动归一化，保留原始数据供确认。"
    )

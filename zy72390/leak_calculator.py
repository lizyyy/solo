import math
from datetime import datetime
from typing import Optional, Tuple, List
from models import (
    LeakRecord, SensorInfo, TemperatureCalibration,
    CorrectionRecord, RecordStatus, CorrectionType
)
from demo_data import get_threshold


STANDARD_TEMP_K = 293.15
STANDARD_PRESSURE_KPA = 101.325
AIR_DENSITY_KG_M3 = 1.204
DISCHARGE_COEFFICIENT = 0.98


def kpa_to_bar(kpa: float) -> float:
    return kpa * 0.01


def mm2_to_m2(mm2: float) -> float:
    return mm2 * 1e-6


def nozzle_area_m2(diameter_mm: float) -> float:
    radius_m = (diameter_mm / 2.0) * 1e-3
    return math.pi * radius_m * radius_m


def temp_c_to_k(temp_c: float) -> float:
    return temp_c + 273.15


def calculate_leakage(
    raw_flow_lmin: float,
    temp_c: float,
    pressure_kpa: float,
    nozzle_diameter_mm: float,
    calibration_factor: float = DISCHARGE_COEFFICIENT
) -> float:
    area = nozzle_area_m2(nozzle_diameter_mm)
    temp_k = temp_c_to_k(temp_c)
    pressure_ratio = pressure_kpa / STANDARD_PRESSURE_KPA
    temp_ratio = STANDARD_TEMP_K / temp_k
    corrected_flow = raw_flow_lmin * math.sqrt(pressure_ratio * temp_ratio)
    leakage = calibration_factor * corrected_flow
    return round(leakage, 2)


def check_threshold(leakage_lmin: float) -> Tuple[bool, RecordStatus]:
    threshold = get_threshold()
    if leakage_lmin > threshold:
        return True, RecordStatus.OVER_THRESHOLD
    return False, RecordStatus.NORMAL


def average_with_surroundings(
    target_record: LeakRecord,
    all_records: List[LeakRecord],
    sensor_id: str
) -> Tuple[float, LeakRecord]:
    same_sensor = [r for r in all_records if r.sensor_id == sensor_id and r.record_id != target_record.record_id]
    if not same_sensor:
        same_sensor = [r for r in all_records if r.record_id != target_record.record_id]

    valid_values = [r.estimated_leak_lmin for r in same_sensor if r.estimated_leak_lmin is not None]
    if valid_values:
        avg_value = sum(valid_values) / len(valid_values)
    else:
        avg_value = target_record.estimated_leak_lmin or 0.0

    avg_value = round(avg_value, 2)

    averaged_record = LeakRecord(
        record_id=f"{target_record.record_id}-R",
        sensor_id=target_record.sensor_id,
        measured_at=target_record.measured_at,
        raw_flow_rate=target_record.raw_flow_rate,
        temp_c=target_record.temp_c,
        pressure_kpa=target_record.pressure_kpa,
        nozzle_diameter_mm=target_record.nozzle_diameter_mm,
        status=RecordStatus.AVERAGED,
        estimated_leak_lmin=avg_value,
        is_averaged=True,
        source_run_id=target_record.run_id,
        original_diameter_mm=target_record.original_diameter_mm or target_record.nozzle_diameter_mm,
        run_id=None
    )
    return avg_value, averaged_record


def apply_calibration_correction(
    record: LeakRecord,
    sensor_info: SensorInfo
) -> Tuple[LeakRecord, CorrectionRecord]:
    old_diameter = record.nozzle_diameter_mm
    new_diameter = sensor_info.nozzle_diameter_mm
    old_leakage = record.estimated_leak_lmin

    new_leakage = calculate_leakage(
        record.raw_flow_rate,
        record.temp_c,
        record.pressure_kpa,
        new_diameter,
        sensor_info.calibration_factor
    )

    corrected_record = LeakRecord(
        record_id=f"{record.record_id}-C",
        sensor_id=record.sensor_id,
        measured_at=record.measured_at,
        raw_flow_rate=record.raw_flow_rate,
        temp_c=record.temp_c,
        pressure_kpa=record.pressure_kpa,
        nozzle_diameter_mm=new_diameter,
        status=RecordStatus.CALIBRATION_UPDATED,
        estimated_leak_lmin=new_leakage,
        is_averaged=False,
        source_run_id=record.run_id,
        original_diameter_mm=old_diameter,
        run_id=None
    )

    correction = CorrectionRecord(
        correction_id=f"COR-{datetime.now().strftime('%H%M%S')}",
        correction_type=CorrectionType.MANUAL_CALIBRATION,
        record_id=record.record_id,
        old_value=old_leakage,
        new_value=new_leakage,
        old_diameter=old_diameter,
        new_diameter=new_diameter,
        operator="林老师",
        corrected_at=datetime.now(),
        reason=f"根据传感器编号 {record.sensor_id} 修正口径：{old_diameter}mm → {new_diameter}mm",
        notes=f"校准因子: {sensor_info.calibration_factor}"
    )

    return corrected_record, correction


def mark_for_review(record: LeakRecord) -> LeakRecord:
    record.status = RecordStatus.PENDING_REVIEW
    return record


def process_first_import(
    raw_records: List[dict],
    calibrations: List[TemperatureCalibration]
) -> List[LeakRecord]:
    cal_map = {c.sensor_id: c for c in calibrations}
    processed = []

    for i, raw in enumerate(raw_records):
        sensor_id = raw["sensor_id"]
        cal = cal_map.get(sensor_id)

        if cal:
            temp_c = cal.temp_c
            pressure_kpa = cal.pressure_kpa
        else:
            temp_c = raw.get("temp_c", 23.0)
            pressure_kpa = raw.get("pressure_kpa", 600.0)

        leakage = calculate_leakage(
            raw["raw_flow_rate"],
            temp_c,
            pressure_kpa,
            raw["nozzle_diameter_mm"]
        )

        is_over, status = check_threshold(leakage)

        record = LeakRecord(
            record_id=f"REC-{i+1:03d}",
            sensor_id=sensor_id,
            measured_at=raw.get("measured_at", datetime.now()),
            raw_flow_rate=raw["raw_flow_rate"],
            temp_c=temp_c,
            pressure_kpa=pressure_kpa,
            nozzle_diameter_mm=raw["nozzle_diameter_mm"],
            status=status,
            estimated_leak_lmin=leakage,
            is_averaged=False,
            run_id="RUN-001"
        )
        processed.append(record)

    return processed

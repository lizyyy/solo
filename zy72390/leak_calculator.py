import math
from datetime import datetime
from typing import Tuple, List
from models import (
    LeakRecord, SensorInfo, TemperatureCalibration,
    CorrectionRecord, RecordStatus, CorrectionType
)


STANDARD_TEMP_K = 293.15
STANDARD_PRESSURE_KPA = 101.325
AIR_DENSITY_KG_M3 = 1.204
DISCHARGE_COEFFICIENT = 0.98
REFERENCE_DIAMETER_MM = 2.0
LEAK_THRESHOLD_LMIN = 20.0


def get_threshold() -> float:
    return LEAK_THRESHOLD_LMIN


def kpa_to_bar(kpa: float) -> float:
    return kpa * 0.01


def mm2_to_m2(mm2: float) -> float:
    return mm2 * 1e-6


def nozzle_area_mm2(diameter_mm: float) -> float:
    return math.pi * (diameter_mm / 2.0) ** 2


def nozzle_area_m2(diameter_mm: float) -> float:
    return mm2_to_m2(nozzle_area_mm2(diameter_mm))


def temp_c_to_k(temp_c: float) -> float:
    return temp_c + 273.15


def calculate_leakage(
    raw_flow_lmin: float,
    temp_c: float,
    pressure_kpa: float,
    nozzle_diameter_mm: float,
    calibration_factor: float = DISCHARGE_COEFFICIENT
) -> float:
    A_ref = nozzle_area_mm2(REFERENCE_DIAMETER_MM)
    A_nozzle = nozzle_area_mm2(nozzle_diameter_mm)
    area_ratio = A_ref / A_nozzle
    temp_correction = math.sqrt(STANDARD_TEMP_K / temp_c_to_k(temp_c))
    estimated = calibration_factor * raw_flow_lmin * area_ratio * temp_correction
    return round(estimated, 2)


def check_threshold(leakage_lmin: float) -> Tuple[bool, RecordStatus]:
    if leakage_lmin > LEAK_THRESHOLD_LMIN:
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

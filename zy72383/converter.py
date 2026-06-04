from datetime import datetime
from typing import List, Optional, Tuple
from models import CylinderConversionRecord, RecordStatus
from sensor_detector import update_sensor_id, require_safety_officer_review
from safety_reminder import auto_apply_reminders


def convert_pressure_to_standard(
    raw_pressure: float,
    raw_temperature: float,
    calibrated_temperature: Optional[float] = None,
    reference_temperature: float = 20.0
) -> Tuple[float, dict]:
    use_temp = calibrated_temperature if calibrated_temperature is not None else raw_temperature

    t_kelvin = use_temp + 273.15
    t_ref_kelvin = reference_temperature + 273.15

    converted_pressure = raw_pressure * t_ref_kelvin / t_kelvin

    details = {
        "raw_pressure": raw_pressure,
        "raw_temperature": raw_temperature,
        "calibrated_temperature": calibrated_temperature,
        "use_temperature": use_temp,
        "reference_temperature": reference_temperature,
        "t_kelvin": round(t_kelvin, 2),
        "t_ref_kelvin": round(t_ref_kelvin, 2),
        "conversion_ratio": round(t_ref_kelvin / t_kelvin, 4)
    }

    return round(converted_pressure, 4), details


def can_convert(record: CylinderConversionRecord) -> Tuple[bool, List[str]]:
    blockers: List[str] = []

    if record.raw_pressure <= 0:
        blockers.append("缺少压力读数")

    if record.status == RecordStatus.SENSOR_ABNORMAL:
        blockers.append("传感器编号异常，需先补录确认")

    if record.status == RecordStatus.PENDING_REVIEW:
        blockers.append("等待安全员复核中")

    if record.caliber_mismatch:
        blockers.append("传感器口径不匹配")

    return len(blockers) == 0, blockers


def perform_conversion(
    record: CylinderConversionRecord,
    operator: str,
    reference_temperature: float = 20.0
) -> CylinderConversionRecord:
    can_do, blockers = can_convert(record)
    if not can_do:
        raise ValueError(f"无法进行换算: {'; '.join(blockers)}")

    converted_pressure, details = convert_pressure_to_standard(
        raw_pressure=record.raw_pressure,
        raw_temperature=record.raw_temperature,
        calibrated_temperature=record.calibrated_temperature,
        reference_temperature=reference_temperature
    )

    record.converted_pressure = converted_pressure
    record.status = RecordStatus.CONVERTED

    note = (
        f"原始压力 {details['raw_pressure']} MPa, "
        f"使用温度 {details['use_temperature']}℃, "
        f"基准温度 {details['reference_temperature']}℃, "
        f"换算系数 {details['conversion_ratio']}, "
        f"换算结果 {converted_pressure} MPa"
    )
    record.add_log("完成压力温度换算", operator, note)

    auto_apply_reminders(record)
    return record


def manual_correct(
    record: CylinderConversionRecord,
    corrected_pressure: float,
    operator: str,
    correction_note: str
) -> CylinderConversionRecord:
    record.converted_pressure = corrected_pressure
    record.manual_correction_note = correction_note
    record.status = RecordStatus.MANUAL_CORRECTED

    note = f"人工修正换算结果为 {corrected_pressure} MPa，修正原因: {correction_note}"
    record.add_log("人工修正换算结果", operator, note)

    auto_apply_reminders(record)
    return record


def rerun_conversion(
    record: CylinderConversionRecord,
    operator: str,
    reference_temperature: Optional[float] = None,
    new_raw_pressure: Optional[float] = None,
    new_raw_temperature: Optional[float] = None,
    new_calibrated_temperature: Optional[float] = None
) -> CylinderConversionRecord:
    if new_raw_pressure is not None:
        record.raw_pressure = new_raw_pressure
        record.add_log("更新原始压力", operator, f"新值: {new_raw_pressure} MPa")

    if new_raw_temperature is not None:
        record.raw_temperature = new_raw_temperature
        record.add_log("更新原始温度", operator, f"新值: {new_raw_temperature}℃")

    if new_calibrated_temperature is not None:
        record.calibrated_temperature = new_calibrated_temperature
        record.add_log("更新校准温度", operator, f"新值: {new_calibrated_temperature}℃")

    ref_temp = reference_temperature if reference_temperature is not None else 20.0
    return perform_conversion(record, operator, ref_temp)


def update_sensor_and_refresh_reminders(
    record: CylinderConversionRecord,
    confirmed_sensor_id: str,
    operator: str,
    expected_sensor_id: Optional[str] = None
) -> CylinderConversionRecord:
    record = update_sensor_id(record, confirmed_sensor_id, operator)
    record = auto_apply_reminders(record, expected_sensor_id)
    return record


def safety_officer_review(
    record: CylinderConversionRecord,
    operator: str,
    review_result: str,
    approve: bool = True
) -> CylinderConversionRecord:
    if record.status != RecordStatus.PENDING_REVIEW:
        raise ValueError(f"当前状态[{record.status.value}]无需安全员复核")

    if approve:
        record.status = RecordStatus.REVIEWED
        note = f"安全员复核通过: {review_result}"
    else:
        record.status = RecordStatus.SENSOR_ABNORMAL
        note = f"安全员复核不通过，需重新处理: {review_result}"

    record.add_log("安全员复核", operator, note)

    for reminder in record.safety_reminders:
        if "传感器编号已补录" in reminder.title and not reminder.is_resolved:
            reminder.is_resolved = True
            reminder.resolved_time = datetime.now()
            reminder.resolved_note = f"安全员复核{'通过' if approve else '不通过'}: {review_result}"
            record.add_log("关闭安全提醒", operator, reminder.title)

    auto_apply_reminders(record)
    return record


def update_pressure_data(
    record: CylinderConversionRecord,
    raw_pressure: float,
    operator: str
) -> CylinderConversionRecord:
    record.raw_pressure = raw_pressure
    record.add_log("补录压力数据", operator, f"压力值: {raw_pressure} MPa")
    auto_apply_reminders(record)
    return record


def fix_caliber(
    record: CylinderConversionRecord,
    correct_caliber: str,
    operator: str
) -> CylinderConversionRecord:
    record.caliber_actual = correct_caliber
    record.caliber_mismatch = (correct_caliber != record.caliber_expected)

    if record.caliber_mismatch:
        note = f"仍不匹配，修正后口径: {correct_caliber}，期望: {record.caliber_expected}"
    else:
        note = f"口径已修正为: {correct_caliber}，匹配成功"

    record.add_log("修正传感器口径", operator, note)
    auto_apply_reminders(record)
    return record

from datetime import datetime, timedelta
from typing import List, Tuple, Optional
from .models import (
    SensorRecord,
    WorkingConditionPhoto,
    VerificationRecord,
    RecordStatus,
    ConflictEvidence,
    CaliberType,
)


def detect_missing_half_hour(record: SensorRecord) -> bool:
    minute = record.sample_time.minute
    second = record.sample_time.second
    return not (
        (minute == 0 and second == 0) or
        (minute == 30 and second == 0)
    )


def detect_caliber_conflict(
    sensor_record: SensorRecord,
    photo_record: WorkingConditionPhoto,
) -> Optional[ConflictEvidence]:
    if sensor_record.caliber != photo_record.caliber:
        return ConflictEvidence(
            conflict_type="caliber_mismatch",
            sensor_value=sensor_record.caliber.value,
            photo_value=photo_record.caliber.value,
            description=f"传感器口径为{sensor_record.caliber.value}，工况照片口径为{photo_record.caliber.value}",
        )
    return None


def detect_sensor_id_conflict(
    sensor_record: SensorRecord,
    photo_record: WorkingConditionPhoto,
) -> Optional[ConflictEvidence]:
    if sensor_record.sensor_id != photo_record.sensor_id:
        return ConflictEvidence(
            conflict_type="sensor_id_mismatch",
            sensor_value=sensor_record.sensor_id,
            photo_value=photo_record.sensor_id,
            description=f"传感器编号为{sensor_record.sensor_id}，工况照片传感器编号为{photo_record.sensor_id}",
        )
    return None


def detect_all_conflicts(
    sensor_record: SensorRecord,
    photo_record: Optional[WorkingConditionPhoto],
) -> List[ConflictEvidence]:
    conflicts = []
    if photo_record is not None:
        id_conflict = detect_sensor_id_conflict(sensor_record, photo_record)
        if id_conflict:
            conflicts.append(id_conflict)
        caliber_conflict = detect_caliber_conflict(sensor_record, photo_record)
        if caliber_conflict:
            conflicts.append(caliber_conflict)
    return conflicts


def determine_initial_status(
    sensor_record: SensorRecord,
    photo_record: Optional[WorkingConditionPhoto] = None,
) -> RecordStatus:
    missing_half_hour = detect_missing_half_hour(sensor_record)

    if photo_record is not None and photo_record.supplement_note:
        if missing_half_hour:
            return RecordStatus.SUPPLEMENTED
        return RecordStatus.SUPPLEMENTED

    if missing_half_hour:
        return RecordStatus.PENDING_REVIEW

    conflicts = detect_all_conflicts(sensor_record, photo_record)
    if conflicts:
        return RecordStatus.CONFLICT

    return RecordStatus.NORMAL


def create_verification_record(
    sensor_record: SensorRecord,
    photo_record: Optional[WorkingConditionPhoto] = None,
    record_id: Optional[str] = None,
) -> VerificationRecord:
    if record_id is None:
        record_id = f"REC_{sensor_record.sensor_id}_{sensor_record.sample_time.strftime('%Y%m%d%H%M%S')}"

    status = determine_initial_status(sensor_record, photo_record)
    conflicts = detect_all_conflicts(sensor_record, photo_record)

    return VerificationRecord(
        record_id=record_id,
        sensor_record=sensor_record,
        photo_record=photo_record,
        status=status,
        conflicts=conflicts,
    )


def apply_supplement_from_photo(
    record: VerificationRecord,
    photo_record: WorkingConditionPhoto,
) -> VerificationRecord:
    record.photo_record = photo_record
    record.sensor_record.caliber = photo_record.caliber
    record.sensor_record.notes = f"补录自工况照片 {photo_record.photo_id}"
    record.sensor_record.source = "photo_supplement"

    new_conflicts = detect_all_conflicts(record.sensor_record, photo_record)
    record.conflicts = new_conflicts

    if new_conflicts:
        record.status = RecordStatus.CONFLICT
    else:
        record.status = RecordStatus.SUPPLEMENTED

    record.updated_at = datetime.now()
    return record


def confirm_conflict_resolution(
    record: VerificationRecord,
    confirmed: bool,
    reviewer: str = "老唐",
    comments: str = "",
) -> VerificationRecord:
    if confirmed:
        record.status = RecordStatus.CONFIRMED
    else:
        record.status = RecordStatus.REJECTED

    record.reviewer = reviewer
    record.review_comments = comments
    record.updated_at = datetime.now()
    return record


def approve_pending_review(
    record: VerificationRecord,
    reviewer: str = "质检员",
    comments: str = "",
) -> VerificationRecord:
    if record.status == RecordStatus.PENDING_REVIEW:
        record.status = RecordStatus.MISSING_HALF_HOUR
        record.reviewer = reviewer
        record.review_comments = comments
        record.updated_at = datetime.now()
    return record

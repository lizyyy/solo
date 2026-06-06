from datetime import datetime
from .models import SensorRecord, WorkingConditionPhoto, CaliberType


def create_normal_sample() -> tuple[SensorRecord, WorkingConditionPhoto]:
    sensor = SensorRecord(
        sensor_id="S-001",
        sample_time=datetime(2026, 6, 5, 10, 0, 0),
        coverage_rate=92.5,
        pressure=3.2,
        caliber=CaliberType.NEW,
        source="sensor_import",
        notes="正常采样",
    )
    photo = WorkingConditionPhoto(
        photo_id="P-001",
        sensor_id="S-001",
        capture_time=datetime(2026, 6, 5, 10, 1, 0),
        caliber=CaliberType.NEW,
        coverage_visual="覆盖均匀，无明显死角",
    )
    return sensor, photo


def create_missing_half_hour_sample() -> tuple[SensorRecord, WorkingConditionPhoto]:
    sensor = SensorRecord(
        sensor_id="S-002",
        sample_time=datetime(2026, 6, 5, 10, 15, 0),
        coverage_rate=88.0,
        pressure=3.0,
        caliber=CaliberType.NEW,
        source="sensor_import",
        notes=None,
    )
    photo = WorkingConditionPhoto(
        photo_id="P-002",
        sensor_id="S-002",
        capture_time=datetime(2026, 6, 5, 10, 16, 0),
        caliber=CaliberType.NEW,
        coverage_visual="覆盖基本达标",
    )
    return sensor, photo


def create_supplemented_old_caliber_sample() -> tuple[SensorRecord, WorkingConditionPhoto]:
    sensor = SensorRecord(
        sensor_id="S-003",
        sample_time=datetime(2026, 6, 4, 14, 45, 0),
        coverage_rate=85.5,
        pressure=2.8,
        caliber=CaliberType.NEW,
        source="sensor_import",
        notes=None,
    )
    photo = WorkingConditionPhoto(
        photo_id="P-003",
        sensor_id="S-003",
        capture_time=datetime(2026, 6, 4, 14, 46, 0),
        caliber=CaliberType.OLD,
        coverage_visual="旧口径喷淋，覆盖范围稍小",
        supplement_note="从历史工况照片补录，该传感器当时使用旧口径",
    )
    return sensor, photo


def create_conflict_sample() -> tuple[SensorRecord, WorkingConditionPhoto]:
    sensor = SensorRecord(
        sensor_id="S-004",
        sample_time=datetime(2026, 6, 5, 11, 0, 0),
        coverage_rate=90.0,
        pressure=3.1,
        caliber=CaliberType.NEW,
        source="sensor_import",
        notes=None,
    )
    photo = WorkingConditionPhoto(
        photo_id="P-004",
        sensor_id="S-004",
        capture_time=datetime(2026, 6, 5, 11, 1, 0),
        caliber=CaliberType.OLD,
        coverage_visual="照片显示为旧口径喷嘴",
    )
    return sensor, photo


def get_all_samples() -> tuple[list[SensorRecord], list[WorkingConditionPhoto]]:
    s1, p1 = create_normal_sample()
    s2, p2 = create_missing_half_hour_sample()
    s3, p3 = create_supplemented_old_caliber_sample()

    sensors = [s1, s2, s3]
    photos = [p1, p2, p3]

    return sensors, photos

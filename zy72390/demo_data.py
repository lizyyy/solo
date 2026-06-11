from datetime import datetime, timedelta
from models import (
    TemperatureCalibration, SensorInfo, LeakRecord,
    CorrectionRecord, RunHistory, RecordStatus, CorrectionType
)
from leak_calculator import calculate_leakage, get_threshold, REFERENCE_DIAMETER_MM


BASE_TIME = datetime(2026, 6, 5, 9, 0, 0)


def make_calibrations() -> list[TemperatureCalibration]:
    return [
        TemperatureCalibration(
            calibration_id="CAL-001",
            sensor_id="SNS-A01",
            temp_c=23.5,
            pressure_kpa=600.0,
            calibrated_at=BASE_TIME - timedelta(days=7),
            operator="林老师"
        ),
        TemperatureCalibration(
            calibration_id="CAL-002",
            sensor_id="SNS-A02",
            temp_c=24.0,
            pressure_kpa=605.0,
            calibrated_at=BASE_TIME - timedelta(days=7),
            operator="林老师"
        ),
        TemperatureCalibration(
            calibration_id="CAL-003",
            sensor_id="SNS-A03",
            temp_c=23.8,
            pressure_kpa=598.0,
            calibrated_at=BASE_TIME - timedelta(days=7),
            operator="林老师"
        ),
    ]


def make_sensors() -> list[SensorInfo]:
    return [
        SensorInfo(
            sensor_id="SNS-A01",
            nozzle_diameter_mm=2.0,
            calibration_factor=0.98,
            installed_at=BASE_TIME - timedelta(days=30),
            location="一号车间 A 区",
            notes="正常服役"
        ),
        SensorInfo(
            sensor_id="SNS-A02",
            nozzle_diameter_mm=3.0,
            calibration_factor=0.97,
            installed_at=BASE_TIME - timedelta(days=30),
            location="一号车间 B 区",
            notes="2026-06-01 口径从 2.5mm 改为 3.0mm，旧记录口径为 2.5mm"
        ),
        SensorInfo(
            sensor_id="SNS-A03",
            nozzle_diameter_mm=2.5,
            calibration_factor=0.99,
            installed_at=BASE_TIME - timedelta(days=30),
            location="一号车间 C 区",
            notes="正常服役"
        ),
    ]


def make_first_run_records() -> list[LeakRecord]:
    t0 = BASE_TIME + timedelta(minutes=0)
    t1 = BASE_TIME + timedelta(minutes=5)
    t2 = BASE_TIME + timedelta(minutes=10)
    threshold = get_threshold()

    rec001_leak = calculate_leakage(12.5, 23.5, 600.0, 2.0, 0.98)
    rec002_leak = calculate_leakage(45.0, 24.2, 602.0, 2.5, 0.97)
    rec003_leak = calculate_leakage(18.0, 23.9, 599.0, 2.5, 0.99)

    rec002_status = RecordStatus.OVER_THRESHOLD if rec002_leak > threshold else RecordStatus.NORMAL

    return [
        LeakRecord(
            record_id="REC-001",
            sensor_id="SNS-A01",
            measured_at=t0,
            raw_flow_rate=12.5,
            temp_c=23.5,
            pressure_kpa=600.0,
            nozzle_diameter_mm=2.0,
            status=RecordStatus.NORMAL,
            estimated_leak_lmin=rec001_leak,
            is_averaged=False,
            run_id="RUN-001"
        ),
        LeakRecord(
            record_id="REC-002",
            sensor_id="SNS-A02",
            measured_at=t1,
            raw_flow_rate=45.0,
            temp_c=24.2,
            pressure_kpa=602.0,
            nozzle_diameter_mm=2.5,
            status=rec002_status,
            estimated_leak_lmin=rec002_leak,
            is_averaged=False,
            run_id="RUN-001",
            original_diameter_mm=2.5
        ),
        LeakRecord(
            record_id="REC-003",
            sensor_id="SNS-A03",
            measured_at=t2,
            raw_flow_rate=18.0,
            temp_c=23.9,
            pressure_kpa=599.0,
            nozzle_diameter_mm=2.5,
            status=RecordStatus.NORMAL,
            estimated_leak_lmin=rec003_leak,
            is_averaged=False,
            run_id="RUN-001"
        ),
    ]


def make_corrections() -> list[CorrectionRecord]:
    first_run = make_first_run_records()
    rec002 = first_run[1]
    sensors = make_sensors()
    sns_a02 = next(s for s in sensors if s.sensor_id == "SNS-A02")

    corrected_leak = calculate_leakage(
        rec002.raw_flow_rate, rec002.temp_c, rec002.pressure_kpa,
        sns_a02.nozzle_diameter_mm, sns_a02.calibration_factor
    )

    return [
        CorrectionRecord(
            correction_id="COR-001",
            correction_type=CorrectionType.SENSOR_ID_LOOKUP,
            record_id="REC-002",
            old_value=rec002.estimated_leak_lmin,
            new_value=corrected_leak,
            old_diameter=2.5,
            new_diameter=3.0,
            operator="林老师",
            corrected_at=BASE_TIME + timedelta(minutes=20),
            reason="传感器编号补查发现 SNS-A02 口径已于 6 月 1 日改为 3.0mm，原记录用了旧口径 2.5mm",
            notes="来自历史档案：安装记录第 2026-06-001 号"
        ),
        CorrectionRecord(
            correction_id="COR-002",
            correction_type=CorrectionType.UNIT_UPDATE,
            record_id=None,
            old_value=None,
            new_value=None,
            old_diameter=None,
            new_diameter=None,
            operator="林老师",
            corrected_at=BASE_TIME + timedelta(minutes=22),
            reason="单位换算说明更新：明确 kPa 到 bar 的换算为 0.01，mm² 到 m² 的换算为 1e-6",
            notes="避免新人误用英制单位"
        ),
    ]


def make_rerun_records() -> list[LeakRecord]:
    t1 = BASE_TIME + timedelta(minutes=30)
    first_run = make_first_run_records()
    threshold = get_threshold()

    sensors = make_sensors()
    sns_a02 = next(s for s in sensors if s.sensor_id == "SNS-A02")

    rec002 = first_run[1]
    corrected_leak = calculate_leakage(
        rec002.raw_flow_rate, rec002.temp_c, rec002.pressure_kpa,
        sns_a02.nozzle_diameter_mm, sns_a02.calibration_factor
    )

    other_values = [
        r.estimated_leak_lmin for r in first_run
        if r.record_id != rec002.record_id and r.estimated_leak_lmin is not None
    ]
    avg_value = round(sum(other_values) / len(other_values), 2) if other_values else 0.0

    backfill_leak = calculate_leakage(26.5, 23.7, 600.0, 2.5, 0.97)

    return [
        LeakRecord(
            record_id="REC-002-R",
            sensor_id="SNS-A02",
            measured_at=t1,
            raw_flow_rate=45.0,
            temp_c=24.2,
            pressure_kpa=602.0,
            nozzle_diameter_mm=3.0,
            status=RecordStatus.AVERAGED,
            estimated_leak_lmin=avg_value,
            is_averaged=True,
            source_run_id="RUN-001",
            run_id="RUN-002",
            original_diameter_mm=2.5
        ),
        LeakRecord(
            record_id="REC-004",
            sensor_id="SNS-A02",
            measured_at=BASE_TIME - timedelta(days=2, hours=2),
            raw_flow_rate=26.5,
            temp_c=23.7,
            pressure_kpa=600.0,
            nozzle_diameter_mm=2.5,
            status=RecordStatus.BACKFILLED,
            estimated_leak_lmin=backfill_leak,
            is_averaged=False,
            is_backfilled=True,
            run_id="RUN-002",
            original_diameter_mm=2.5
        ),
    ]


def make_run_histories() -> list[RunHistory]:
    return [
        RunHistory(
            run_id="RUN-001",
            started_at=BASE_TIME,
            ended_at=BASE_TIME + timedelta(minutes=15),
            operator="张同学",
            description="第一次导入，温度校准记录导入完成，未查传感器编号",
            record_ids=["REC-001", "REC-002", "REC-003"],
            correction_ids=[]
        ),
        RunHistory(
            run_id="RUN-002",
            started_at=BASE_TIME + timedelta(minutes=25),
            ended_at=BASE_TIME + timedelta(minutes=35),
            operator="林老师",
            description="林老师补查传感器编号后重跑，补录旧口径数据",
            record_ids=["REC-002-R", "REC-004"],
            correction_ids=["COR-001", "COR-002"]
        ),
    ]


def get_unit_explanation() -> dict:
    return {
        "raw_flow_rate": "原始流量读数，单位：L/min（升/分钟）",
        "temp_c": "环境温度，单位：°C（摄氏度）",
        "pressure_kpa": "系统压力，单位：kPa（千帕），换算为 bar 需乘以 0.01",
        "nozzle_diameter_mm": f"喷嘴口径，单位：mm（毫米），截面积 = π×(d/2)²，参考口径 {REFERENCE_DIAMETER_MM}mm",
        "estimated_leak_lmin": f"估算泄漏量，单位：L/min，公式：Q = C × 原始流量 × (A_ref/A_nozzle) × √(T_std/T_actual)",
        "threshold": f"泄漏阈值：{get_threshold()} L/min，超过则判定为超阈值",
        "conversions": [
            "1 kPa = 0.01 bar",
            "1 mm² = 1 × 10^-6 m²",
            f"参考口径：{REFERENCE_DIAMETER_MM} mm（A_ref = π×({REFERENCE_DIAMETER_MM}/2)² mm²）",
            f"面积比 A_ref/A_nozzle：口径越大，比值越小，估算泄漏越低",
            "标准状态：20°C (293.15 K)，101.325 kPa",
            "完整公式：Q = C × raw × (A_ref / A_nozzle) × √(T_std / T_actual)"
        ]
    }

from datetime import datetime, timedelta
from models import (
    SamplingInterval,
    TemperatureCalibration,
    DefrostEnergyRecord,
    RecordStatus,
    UnitCaliber,
    ManualCorrection,
    ReplayRun
)


def create_demo_sampling_interval() -> SamplingInterval:
    return SamplingInterval(
        start_time=datetime(2025, 1, 15, 0, 0),
        end_time=datetime(2025, 1, 16, 0, 0),
        interval_minutes=30,
        description="2025年1月15日 热泵除霜能耗采样，每30分钟采一次，共48个采样点",
        import_note="第一次导入采样间隔说明，老岑师傅说这天寒潮，除霜频繁，数据有看头"
    )


def create_demo_temperature_calibrations() -> list[TemperatureCalibration]:
    return [
        TemperatureCalibration(
            record_time=datetime(2025, 1, 15, 2, 30),
            sensor_id="TS-001-OUT",
            raw_temperature=-18.5,
            calibrated_temperature=-15.2,
            calibration_offset=3.3,
            calibration_note="老岑师傅凌晨2点半巡楼，发现室外传感器飘了3度多，现场校准",
            recorded_by="老岑",
            caliber=UnitCaliber.OLD,
            caliber_note="这是2023年校准的老记录，用的是旧口径"
        ),
        TemperatureCalibration(
            record_time=datetime(2025, 1, 15, 14, 15),
            sensor_id="TS-002-COIL",
            raw_temperature=-8.2,
            calibrated_temperature=-5.8,
            calibration_offset=2.4,
            calibration_note="盘管传感器第二次校准，老岑说这表冬天就爱飘",
            recorded_by="老岑",
            caliber=UnitCaliber.OLD,
            caliber_note="旧口径校准记录"
        ),
        TemperatureCalibration(
            record_time=datetime(2025, 1, 15, 23, 45),
            sensor_id="TS-001-OUT",
            raw_temperature=-22.0,
            calibrated_temperature=-19.5,
            calibration_offset=2.5,
            calibration_note="睡前再校一次，这天实在太冷了",
            recorded_by="老岑",
            caliber=UnitCaliber.OLD,
            caliber_note="旧口径校准记录"
        )
    ]


def create_demo_defrost_records_initial() -> list[DefrostEnergyRecord]:
    records = []

    records.append(DefrostEnergyRecord(
        id="DEF-20250115-001",
        start_time=datetime(2025, 1, 15, 1, 0),
        end_time=datetime(2025, 1, 15, 1, 12),
        duration_minutes=12,
        energy_consumption_kwh=2.8,
        ambient_temp=-5.2,
        coil_temp=-3.1,
        status=RecordStatus.NORMAL,
        status_note="顺利记录：除霜12分钟，耗电2.8度，一切正常",
        threshold_exceeded=False,
        caliber=UnitCaliber.NEW,
        caliber_note="新口径",
        run_id="initial"
    ))

    records.append(DefrostEnergyRecord(
        id="DEF-20250115-002",
        start_time=datetime(2025, 1, 15, 3, 30),
        end_time=datetime(2025, 1, 15, 3, 48),
        duration_minutes=18,
        energy_consumption_kwh=5.2,
        ambient_temp=-15.8,
        coil_temp=-12.5,
        status=RecordStatus.NORMAL,
        status_note="超阈值被平均值盖掉：当时耗电5.2度超阈值3.5，但前后两次平均值是2.9，"
                   "系统自动用平均值盖了，老岑师傅说这种情况要留着复核",
        threshold_exceeded=True,
        original_value=5.2,
        masked_value=2.9,
        caliber=UnitCaliber.NEW,
        caliber_note="新口径",
        run_id="initial"
    ))

    records.append(DefrostEnergyRecord(
        id="DEF-20250115-003",
        start_time=datetime(2025, 1, 15, 6, 0),
        end_time=datetime(2025, 1, 15, 6, 15),
        duration_minutes=15,
        energy_consumption_kwh=3.0,
        ambient_temp=-8.5,
        coil_temp=-6.2,
        status=RecordStatus.NORMAL,
        status_note="顺利记录：正常除霜，没问题",
        threshold_exceeded=False,
        caliber=UnitCaliber.NEW,
        caliber_note="新口径",
        run_id="initial"
    ))

    records.append(DefrostEnergyRecord(
        id="DEF-20250115-004",
        start_time=datetime(2025, 1, 15, 8, 30),
        end_time=datetime(2025, 1, 15, 8, 55),
        duration_minutes=25,
        energy_consumption_kwh=7.8,
        ambient_temp=-12.0,
        coil_temp=-9.8,
        status=RecordStatus.NORMAL,
        status_note="超阈值：耗电7.8度，超了阈值3.5一倍多，系统标了异常",
        threshold_exceeded=True,
        caliber=UnitCaliber.NEW,
        caliber_note="新口径",
        run_id="initial"
    ))

    records.append(DefrostEnergyRecord(
        id="DEF-20250115-005",
        start_time=datetime(2025, 1, 15, 11, 0),
        end_time=datetime(2025, 1, 15, 11, 10),
        duration_minutes=10,
        energy_consumption_kwh=2.1,
        ambient_temp=-3.5,
        coil_temp=-1.8,
        status=RecordStatus.NORMAL,
        status_note="顺利记录：快速除霜，省电",
        threshold_exceeded=False,
        caliber=UnitCaliber.NEW,
        caliber_note="新口径",
        run_id="initial"
    ))

    return records


def create_demo_manual_correction() -> ManualCorrection:
    return ManualCorrection(
        correction_id="CORR-20250116-001",
        record_id="DEF-20250115-002",
        corrected_by="老岑",
        corrected_at=datetime(2025, 1, 16, 10, 0),
        original_value=2.9,
        corrected_value=5.2,
        correction_note="人工修正：把被平均值盖掉的5.2度改回来，这是真实数据，不能盖"
    )


def create_demo_replay_run() -> ReplayRun:
    return ReplayRun(
        run_id="replay-20250116-001",
        run_time=datetime(2025, 1, 16, 14, 30),
        run_by="老岑",
        description="补录温度校准记录后的重跑，看看口径切换后数据怎么变",
        previous_records_count=5,
        new_records_count=6,
        changes=[
            "DEF-20250115-002：状态从 masked_by_average 改为 over_threshold，恢复原始值5.2",
            "DEF-20250115-006：新增一条从温度校准记录补来的旧口径数据",
            "单位换算说明：从新口径切换为旧口径（因补录了校准记录）"
        ]
    )


def create_supplemented_record() -> DefrostEnergyRecord:
    return DefrostEnergyRecord(
        id="DEF-20250115-006",
        start_time=datetime(2025, 1, 15, 2, 30),
        end_time=datetime(2025, 1, 15, 2, 50),
        duration_minutes=20,
        energy_consumption_kwh=6.1,
        ambient_temp=-15.2,
        coil_temp=-12.8,
        status=RecordStatus.SUPPLEMENTED_FROM_CALIBRATION,
        status_note="从温度校准记录补来的旧口径：老岑师傅凌晨2点半现场记的，"
                   "当时除霜20分钟，按旧口径算6.1度，换算新口径是5.2度",
        threshold_exceeded=True,
        supplemented_from="校准记录 TS-001-OUT 2025-01-15 02:30",
        caliber=UnitCaliber.OLD,
        caliber_note="旧口径，从校准记录补录",
        run_id="replay-20250116-001"
    )


def get_demo_threshold() -> float:
    return 3.5

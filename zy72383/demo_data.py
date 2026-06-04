from datetime import datetime, timedelta
from typing import List, Dict, Tuple
from models import Sensor, TemperatureCalibration
from sensor_detector import SensorRegistry


def create_demo_sensor_registry() -> SensorRegistry:
    registry = SensorRegistry()

    now = datetime.now()

    sensors = [
        Sensor(
            sensor_id="PT100-0042",
            physical_tag="TAG-QP-001",
            location="1号气瓶区-左排第3个",
            install_date=datetime(2025, 3, 15),
            last_restart=now - timedelta(minutes=45)
        ),
        Sensor(
            sensor_id="PT100-0086",
            physical_tag="TAG-QP-002",
            location="1号气瓶区-左排第5个",
            install_date=datetime(2025, 4, 22),
            last_restart=None
        ),
        Sensor(
            sensor_id="PT100-0113",
            physical_tag="TAG-QP-003",
            location="2号气瓶区-右排第2个",
            install_date=datetime(2025, 5, 8),
            last_restart=None
        ),
    ]

    for s in sensors:
        registry.register_sensor(s)

    return registry


def create_demo_calibration_data() -> List[TemperatureCalibration]:
    now = datetime.now()

    return [
        TemperatureCalibration(
            record_id="CAL-2026-0604-001",
            calibrate_time=now - timedelta(minutes=30),
            raw_temperature=26.8,
            calibrated_temperature=25.5,
            calibration_method="冰点槽校准",
            operator="小张",
            sensor_id_reported="PT100-0042-RESET",
            caliber="PT100"
        ),
        TemperatureCalibration(
            record_id="CAL-2026-0604-002",
            calibrate_time=now - timedelta(minutes=25),
            raw_temperature=24.2,
            calibrated_temperature=23.8,
            calibration_method="标准温度计比对",
            operator="小李",
            sensor_id_reported="PT100-0086",
            caliber="PT100"
        ),
        TemperatureCalibration(
            record_id="CAL-2026-0604-003",
            calibrate_time=now - timedelta(minutes=20),
            raw_temperature=27.5,
            calibrated_temperature=26.1,
            calibration_method="冰点槽校准",
            operator="小王",
            sensor_id_reported="PT100-0113",
            caliber="PT1000"
        ),
    ]


def create_demo_pressure_data() -> List[Dict]:
    now = datetime.now()
    return [
        {
            "cylinder_id": "QP-001",
            "raw_pressure": 12.5,
            "calibrate_time": (now - timedelta(minutes=30)).strftime("%Y-%m-%d %H:%M:%S")
        },
        {
            "cylinder_id": "QP-002",
            "raw_pressure": 14.2,
            "calibrate_time": (now - timedelta(minutes=25)).strftime("%Y-%m-%d %H:%M:%S")
        },
        {
            "cylinder_id": "QP-003",
            "raw_pressure": 13.8,
            "calibrate_time": (now - timedelta(minutes=20)).strftime("%Y-%m-%d %H:%M:%S")
        },
    ]


def create_physical_tag_map() -> Dict[str, str]:
    return {
        "QP-001": "TAG-QP-001",
        "QP-002": "TAG-QP-002",
        "QP-003": "TAG-QP-003",
    }


DEMO_SCENARIO_DESCRIPTION = """
=== 演示数据说明（给新人讲流程用）===

【场景】2026年6月4日白班气瓶压力温度换算

【3条记录的故事】
1. QP-001号气瓶：传感器45分钟前重启过，上报编号变成了PT100-0042-RESET
   （正常应该是PT100-0042）——这就是「传感器重启后编号变了」的典型案例
2. QP-002号气瓶：数据正常，用于对比
3. QP-003号气瓶：传感器口径写成了PT1000，实际应该是PT100
   ——这就是现场最常见的「错口径」返工

【完整演示流程】
第一步：导入温度校准记录 → 系统自动检测出2个问题
第二步：训练教练老唐去现场核对物理标签，补录正确的传感器编号
第三步：补录后安全提醒自动更新，从「找老唐」变成「找安全员复核」
第四步：安全员复核后才能进行压力温度换算
第五步：（演示）一次人工修正 + 一次重跑

【设计意图】
- 以前QP-001这种「传感器编号变了」总被当成小备注跳过
- 现在系统会把它标红，安全员复查时最先问到这一条
- 给新人讲：为什么不能跳过？因为编号错了，追溯链就断了，
  后续所有换算结果都可能失真
"""


def save_demo_calibration_csv(file_path: str):
    import csv
    calibrations = create_demo_calibration_data()

    with open(file_path, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f)
        writer.writerow([
            "record_id", "calibrate_time", "raw_temperature",
            "calibrated_temperature", "calibration_method",
            "operator", "sensor_id_reported", "caliber"
        ])
        for cal in calibrations:
            writer.writerow([
                cal.record_id,
                cal.calibrate_time.strftime("%Y-%m-%d %H:%M:%S"),
                cal.raw_temperature,
                cal.calibrated_temperature,
                cal.calibration_method,
                cal.operator,
                cal.sensor_id_reported,
                cal.caliber
            ])


def save_demo_pressure_csv(file_path: str):
    import csv
    pressure_data = create_demo_pressure_data()

    with open(file_path, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["cylinder_id", "raw_pressure", "calibrate_time"])
        for p in pressure_data:
            writer.writerow([p["cylinder_id"], p["raw_pressure"], p["calibrate_time"]])


def get_expected_sensor_id_for_cylinder(
    cylinder_id: str,
    registry: SensorRegistry
) -> Tuple[str, str]:
    tag_map = create_physical_tag_map()
    physical_tag = tag_map.get(cylinder_id, f"TAG-{cylinder_id}")
    expected_id = registry.get_expected_sensor_id(physical_tag)
    return physical_tag, expected_id

from datetime import datetime
from typing import Dict, List, Optional, Tuple
from models import Sensor, CylinderConversionRecord, RecordStatus


class SensorRegistry:
    def __init__(self):
        self._sensors: Dict[str, Sensor] = {}
        self._physical_tag_to_id: Dict[str, str] = {}

    def register_sensor(self, sensor: Sensor):
        self._sensors[sensor.sensor_id] = sensor
        self._physical_tag_to_id[sensor.physical_tag] = sensor.sensor_id

    def get_sensor_by_id(self, sensor_id: str) -> Optional[Sensor]:
        return self._sensors.get(sensor_id)

    def get_sensor_by_physical_tag(self, physical_tag: str) -> Optional[Sensor]:
        sensor_id = self._physical_tag_to_id.get(physical_tag)
        return self._sensors.get(sensor_id) if sensor_id else None

    def get_expected_sensor_id(self, physical_tag: str) -> Optional[str]:
        return self._physical_tag_to_id.get(physical_tag)

    def list_all_sensors(self) -> List[Sensor]:
        return list(self._sensors.values())


def detect_sensor_id_change(
    record: CylinderConversionRecord,
    registry: SensorRegistry,
    physical_tag: str
) -> Tuple[bool, Optional[str], Optional[str]]:
    if not record.sensor_id_original:
        return False, None, None

    expected_id = registry.get_expected_sensor_id(physical_tag)

    if expected_id and record.sensor_id_original != expected_id:
        return True, expected_id, record.sensor_id_original

    return False, expected_id, record.sensor_id_original


def process_sensor_abnormalities(
    records: List[CylinderConversionRecord],
    registry: SensorRegistry,
    physical_tag_map: Optional[Dict[str, str]] = None
) -> List[CylinderConversionRecord]:
    if physical_tag_map is None:
        physical_tag_map = {}

    for record in records:
        cylinder_id = record.cylinder_id
        physical_tag = physical_tag_map.get(cylinder_id, f"TAG-{cylinder_id}")

        is_changed, expected_id, reported_id = detect_sensor_id_change(
            record, registry, physical_tag
        )

        if is_changed:
            record.is_sensor_id_changed = True
            record.status = RecordStatus.SENSOR_ABNORMAL
            record.add_log(
                "检测到传感器编号变化",
                "系统",
                f"物理标签[{physical_tag}] 期望编号[{expected_id}] 上报编号[{reported_id}]，疑似传感器重启后编号变化"
            )

    return records


def is_sensor_restart_detected(
    record: CylinderConversionRecord,
    registry: SensorRegistry
) -> bool:
    if not record.is_sensor_id_changed:
        return False

    sensor = registry.get_sensor_by_id(record.sensor_id_original)
    if sensor and sensor.last_restart:
        restart_to_calib = (record.calibrate_time - sensor.last_restart).total_seconds()
        if 0 <= restart_to_calib <= 3600:
            return True

    return True


def update_sensor_id(
    record: CylinderConversionRecord,
    confirmed_sensor_id: str,
    operator: str
) -> CylinderConversionRecord:
    original_id = record.sensor_id_confirmed or record.sensor_id_original

    record.sensor_id_confirmed = confirmed_sensor_id
    record.status = RecordStatus.SENSOR_UPDATED

    note = f"原上报编号[{record.sensor_id_original}]"
    if original_id and original_id != confirmed_sensor_id:
        note += f" → 确认编号[{confirmed_sensor_id}]"
    else:
        note += f"，补录确认编号[{confirmed_sensor_id}]"

    record.add_log("补录/更新传感器编号", operator, note)
    return record


def require_safety_officer_review(record: CylinderConversionRecord) -> bool:
    return (
        record.is_sensor_id_changed
        and record.status == RecordStatus.SENSOR_UPDATED
    )

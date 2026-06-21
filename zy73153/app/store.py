from __future__ import annotations

from datetime import datetime, timedelta

from .models import (
    DutyStaff,
    DutyRole,
    LabResult,
    PendingRecord,
    RecordStatus,
    SamplingRecord,
    Sensor,
    SensorReading,
    SensorStatus,
    SpatialAnnotation,
)


class DataStore:
    def __init__(self) -> None:
        self.staff: dict[str, DutyStaff] = {}
        self.sensors: dict[str, Sensor] = {}
        self.sensor_history: dict[str, list[SensorReading]] = {}
        self.sampling_records: dict[str, SamplingRecord] = {}
        self.lab_results: dict[str, LabResult] = {}
        self.annotations: dict[str, SpatialAnnotation] = {}
        self.seen_sample_ids: set[str] = set()
        self._seed()

    def _seed(self) -> None:
        self.staff["S001"] = DutyStaff(
            staff_id="S001",
            name="小宋",
            role=DutyRole.STATION_KEEPER,
            phone="138-0000-0001",
            contact_hint="海洋站值班室内线 8001",
        )
        self.staff["S002"] = DutyStaff(
            staff_id="S002",
            name="李工",
            role=DutyRole.SENSOR_TECH,
            phone="138-0000-0002",
            contact_hint="传感器运维组，先看传感器校准日志",
        )
        self.staff["S003"] = DutyStaff(
            staff_id="S003",
            name="王姐",
            role=DutyRole.LAB_TECH,
            phone="138-0000-0003",
            contact_hint="实验室 302，内线 8003",
        )
        self.staff["S004"] = DutyStaff(
            staff_id="S004",
            name="陈排",
            role=DutyRole.SCHEDULER,
            phone="138-0000-0004",
            contact_hint="排班办公室",
        )

        self.sensors["SN-A1"] = Sensor(
            sensor_id="SN-A1",
            name="A1号水温传感器",
            location="1号海域浮标",
            status=SensorStatus.NORMAL,
            drift_threshold=0.15,
            last_calibration=datetime.now() - timedelta(days=15),
            responsible_person_id="S002",
            data_source_url="/api/sensors/SN-A1/history",
        )
        self.sensors["SN-B2"] = Sensor(
            sensor_id="SN-B2",
            name="B2号溶解氧传感器",
            location="2号海域浮标",
            status=SensorStatus.DRIFT_SUSPECTED,
            drift_threshold=0.10,
            last_calibration=datetime.now() - timedelta(days=90),
            responsible_person_id="S002",
            data_source_url="/api/sensors/SN-B2/history",
        )

        hist_base = datetime(2026, 6, 10, 9, 0, 0)
        self.sensor_history["SN-A1"] = [
            SensorReading(hist_base, 18.4, "℃", "现场浮标", "校准后第1天读数"),
            SensorReading(hist_base + timedelta(days=2), 18.6, "℃", "现场浮标", "海况良好"),
            SensorReading(hist_base + timedelta(days=4), 18.5, "℃", "现场浮标", "与实验室一致"),
            SensorReading(hist_base + timedelta(days=5, hours=5), 18.5, "℃", "现场浮标", "SP-20260615-001 对应读数"),
        ]
        self.sensor_history["SN-B2"] = [
            SensorReading(hist_base, 8.2, "mg/L", "现场浮标", "校准后第1天读数"),
            SensorReading(hist_base + timedelta(days=2), 8.1, "mg/L", "现场浮标", "略低于实验室复核"),
            SensorReading(hist_base + timedelta(days=4), 7.9, "mg/L", "现场浮标", "连续下行，疑似漂移起点"),
            SensorReading(hist_base + timedelta(days=5, hours=6), 7.8, "mg/L", "现场浮标", "SP-20260615-002 对应读数，与实验室 8.9 差距扩大"),
            SensorReading(hist_base + timedelta(days=5, hours=6), 8.9, "mg/L", "实验室复核", "王姐实验室当日比对值"),
        ]

        base_time = datetime(2026, 6, 15, 9, 0, 0)
        self.sampling_records["SP-20260615-001"] = SamplingRecord(
            sample_id="SP-20260615-001",
            station_id="ST-01",
            station_name="胶州湾一号站",
            sampling_time=base_time,
            location_lng=120.3826,
            location_lat=36.0671,
            sensor_id="SN-A1",
            sensor_value=18.5,
            operator_id="S001",
            remark="晴，海况良好",
        )
        self.sampling_records["SP-20260615-002"] = SamplingRecord(
            sample_id="SP-20260615-002",
            station_id="ST-02",
            station_name="胶州湾二号站",
            sampling_time=base_time + timedelta(hours=1),
            location_lng=120.3950,
            location_lat=36.0820,
            sensor_id="SN-B2",
            sensor_value=7.8,
            operator_id="S001",
            remark="多云",
        )
        self.sampling_records["SP-20260615-003"] = SamplingRecord(
            sample_id="SP-20260615-003",
            station_id="ST-01",
            station_name="胶州湾一号站",
            sampling_time=base_time + timedelta(hours=2),
            location_lng=120.3826,
            location_lat=36.0671,
            sensor_id="SN-A1",
            sensor_value=19.2,
            operator_id="S001",
        )
        self.sampling_records["SP-20260615-004"] = SamplingRecord(
            sample_id="SP-20260615-004",
            station_id="ST-03",
            station_name="胶州湾三号站",
            sampling_time=base_time + timedelta(hours=3),
            location_lng=120.4100,
            location_lat=36.0950,
            sensor_id="SN-A1",
            sensor_value=17.8,
            operator_id="S001",
        )

        self.lab_results["LB-20260615-001"] = LabResult(
            lab_result_id="LB-20260615-001",
            sample_id="SP-20260615-001",
            sample_time=base_time,
            report_time=base_time + timedelta(hours=4),
            experiment_time=base_time + timedelta(hours=3, minutes=30),
            result_value=18.7,
            result_unit="℃",
            test_item="水温",
        )
        self.lab_results["LB-20260615-002"] = LabResult(
            lab_result_id="LB-20260615-002",
            sample_id="SP-20260615-002",
            sample_time=base_time + timedelta(hours=1),
            report_time=base_time + timedelta(hours=5),
            experiment_time=base_time + timedelta(hours=3, minutes=40),
            result_value=8.9,
            result_unit="mg/L",
            test_item="溶解氧",
        )
        self.lab_results["LB-20260615-003"] = LabResult(
            lab_result_id="LB-20260615-003",
            sample_id="SP-20260615-003",
            sample_time=base_time + timedelta(hours=2),
            report_time=base_time + timedelta(hours=6),
            experiment_time=base_time + timedelta(hours=5, minutes=30),
            result_value=19.0,
            result_unit="℃",
            test_item="水温",
            attachment_arrived=False,
        )
        self.lab_results["LB-20260615-004"] = LabResult(
            lab_result_id="LB-20260615-004",
            sample_id="SP-20260615-004",
            sample_time=base_time + timedelta(hours=3),
            report_time=base_time + timedelta(hours=28),
            experiment_time=base_time + timedelta(days=1, hours=3),
            result_value=18.1,
            result_unit="℃",
            test_item="水温",
        )


store = DataStore()

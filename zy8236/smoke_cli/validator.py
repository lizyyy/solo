"""
数据验证模块
"""

from typing import Dict, List, Set, Optional
from datetime import datetime, timedelta

from smoke_cli.models import (
    Zone, Fan, DamperEvent, SensorMinute, ValidationError, IssueType
)


def validate_data_relations(
    zones: List[Zone],
    fans: List[Fan],
    damper_events: List[DamperEvent],
    sensor_minutes: List[SensorMinute],
) -> List[ValidationError]:
    errors = []

    zone_ids = {z.zone_id for z in zones}
    fan_ids = {f.fan_id for f in fans}
    damper_ids_from_zones = set()
    sensor_ids_from_zones = set()

    for zone in zones:
        damper_ids_from_zones.update(zone.assigned_dampers)
        sensor_ids_from_zones.update(zone.sensors)

        for fan_id in zone.assigned_fans:
            if fan_id not in fan_ids:
                errors.append(ValidationError(
                    file_path="zones.yaml",
                    line_number=None,
                    issue_type=IssueType.INVALID_VALUE,
                    field_name="assigned_fans",
                    message=f"防烟分区 {zone.zone_id} 引用了不存在的风机: {fan_id}",
                ))

    for fan in fans:
        for zone_id in fan.assigned_zones:
            if zone_id not in zone_ids:
                errors.append(ValidationError(
                    file_path="fans.csv",
                    line_number=None,
                    issue_type=IssueType.INVALID_VALUE,
                    field_name="assigned_zones",
                    message=f"风机 {fan.fan_id} 引用了不存在的防烟分区: {zone_id}",
                ))

    event_damper_ids = {e.damper_id for e in damper_events}
    for damper_id in event_damper_ids:
        if damper_id not in damper_ids_from_zones:
            errors.append(ValidationError(
                file_path="damper_events.jsonl",
                line_number=None,
                issue_type=IssueType.INVALID_VALUE,
                field_name="damper_id",
                message=f"阀门事件引用了未分配给任何防烟分区的阀门: {damper_id}",
            ))

    sensor_ids_from_data = {s.sensor_id for s in sensor_minutes}
    for sensor_id in sensor_ids_from_data:
        if sensor_id not in sensor_ids_from_zones:
            errors.append(ValidationError(
                file_path="sensor_minutes.csv",
                line_number=None,
                issue_type=IssueType.INVALID_VALUE,
                field_name="sensor_id",
                message=f"传感器数据引用了未分配给任何防烟分区的传感器: {sensor_id}",
            ))

    return errors


def validate_time_sequences(
    damper_events: List[DamperEvent],
    sensor_minutes: List[SensorMinute],
) -> List[ValidationError]:
    errors = []

    if not damper_events and not sensor_minutes:
        return errors

    all_times = []
    if damper_events:
        all_times.extend(e.event_time for e in damper_events)
    if sensor_minutes:
        all_times.extend(s.timestamp for s in sensor_minutes)

    if not all_times:
        return errors

    min_time = min(all_times)
    max_time = max(all_times)

    errors.extend(_check_midnight_crossing(damper_events, sensor_minutes, min_time, max_time))

    return errors


def _check_midnight_crossing(
    damper_events: List[DamperEvent],
    sensor_minutes: List[SensorMinute],
    min_time: datetime,
    max_time: datetime,
) -> List[ValidationError]:
    errors = []

    time_span = max_time - min_time
    if time_span > timedelta(hours=24):
        return errors

    midnight_candidates = []
    for event in damper_events:
        if event.event_time.hour == 0 and event.event_time.minute < 10:
            midnight_candidates.append(("damper_events.jsonl", event.event_time, event.raw_line))

    for sensor in sensor_minutes:
        if sensor.timestamp.hour == 0 and sensor.timestamp.minute < 10:
            midnight_candidates.append(("sensor_minutes.csv", sensor.timestamp, f"sensor_id={sensor.sensor_id}"))

    if len(midnight_candidates) > 0:
        for file_path, event_time, raw in midnight_candidates:
            errors.append(ValidationError(
                file_path=file_path,
                line_number=None,
                issue_type=IssueType.MIDNIGHT_EVENT_MISASSIGNMENT,
                field_name="event_time/timestamp",
                message=f"跨午夜事件可能存在归属错误，请核实时间: {event_time}",
                raw_value=raw,
            ))

    return errors


def validate_sensor_continuity(
    sensor_minutes: List[SensorMinute],
    gap_threshold_minutes: int = 5,
) -> List[ValidationError]:
    errors = []

    sensors: Dict[str, List[SensorMinute]] = {}
    for sm in sensor_minutes:
        if sm.sensor_id not in sensors:
            sensors[sm.sensor_id] = []
        sensors[sm.sensor_id].append(sm)

    for sensor_id, readings in sensors.items():
        readings.sort(key=lambda x: x.timestamp)

        for i in range(1, len(readings)):
            prev = readings[i - 1]
            curr = readings[i]
            gap = curr.timestamp - prev.timestamp

            if gap > timedelta(minutes=gap_threshold_minutes):
                errors.append(ValidationError(
                    file_path="sensor_minutes.csv",
                    line_number=None,
                    issue_type=IssueType.SENSOR_GAP,
                    field_name="timestamp",
                    message=f"传感器 {sensor_id} 存在数据断采: {prev.timestamp} 到 {curr.timestamp}, 断采时长 {gap.total_seconds() / 60:.1f} 分钟",
                ))

    return errors


def run_full_validation(
    data: Dict,
    gap_threshold_minutes: int = 5,
) -> List[ValidationError]:
    all_errors = []

    all_errors.extend(validate_data_relations(
        zones=data.get("zones", []),
        fans=data.get("fans", []),
        damper_events=data.get("damper_events", []),
        sensor_minutes=data.get("sensor_minutes", []),
    ))

    all_errors.extend(validate_time_sequences(
        damper_events=data.get("damper_events", []),
        sensor_minutes=data.get("sensor_minutes", []),
    ))

    all_errors.extend(validate_sensor_continuity(
        sensor_minutes=data.get("sensor_minutes", []),
        gap_threshold_minutes=gap_threshold_minutes,
    ))

    return all_errors

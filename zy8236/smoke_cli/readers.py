"""
数据读取模块
"""

import csv
import json
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Tuple, Optional

import yaml

from smoke_cli.models import (
    Zone, Fan, DamperEvent, SensorMinute, ValidationError, IssueType
)


def parse_datetime(dt_str: str) -> datetime:
    formats = [
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%Y/%m/%d %H:%M:%S",
        "%Y/%m/%d %H:%M",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%dT%H:%M",
    ]
    for fmt in formats:
        try:
            return datetime.strptime(dt_str.strip(), fmt)
        except (ValueError, TypeError):
            continue
    raise ValueError(f"无法解析时间格式: {dt_str}")


def read_zones(file_path: str) -> Tuple[List[Zone], List[ValidationError]]:
    zones = []
    errors = []
    path = Path(file_path)
    
    if not path.exists():
        errors.append(ValidationError(
            file_path=str(path),
            line_number=None,
            issue_type=IssueType.MISSING_FIELD,
            field_name=None,
            message=f"文件不存在: {file_path}",
        ))
        return zones, errors

    try:
        with open(path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
    except Exception as e:
        errors.append(ValidationError(
            file_path=str(path),
            line_number=None,
            issue_type=IssueType.INVALID_VALUE,
            field_name=None,
            message=f"YAML解析错误: {str(e)}",
        ))
        return zones, errors

    if not isinstance(data, list):
        errors.append(ValidationError(
            file_path=str(path),
            line_number=None,
            issue_type=IssueType.INVALID_VALUE,
            field_name=None,
            message="顶层应为数组格式",
        ))
        return zones, errors

    for idx, zone_data in enumerate(data, start=1):
        required_fields = ["zone_id", "zone_name", "floor", "area"]
        missing = [f for f in required_fields if f not in zone_data]
        
        if missing:
            errors.append(ValidationError(
                file_path=str(path),
                line_number=idx,
                issue_type=IssueType.MISSING_FIELD,
                field_name=", ".join(missing),
                message=f"缺少必需字段: {', '.join(missing)}",
                raw_value=str(zone_data),
            ))
            continue

        try:
            zone = Zone(
                zone_id=str(zone_data["zone_id"]),
                zone_name=str(zone_data["zone_name"]),
                floor=int(zone_data["floor"]),
                area=float(zone_data["area"]),
                assigned_fans=[str(f) for f in zone_data.get("assigned_fans", [])],
                assigned_dampers=[str(d) for d in zone_data.get("assigned_dampers", [])],
                sensors=[str(s) for s in zone_data.get("sensors", [])],
            )
            zones.append(zone)
        except (ValueError, TypeError) as e:
            errors.append(ValidationError(
                file_path=str(path),
                line_number=idx,
                issue_type=IssueType.INVALID_VALUE,
                field_name=None,
                message=f"字段值无效: {str(e)}",
                raw_value=str(zone_data),
            ))

    return zones, errors


def read_fans(file_path: str) -> Tuple[List[Fan], List[ValidationError]]:
    fans = []
    errors = []
    path = Path(file_path)

    if not path.exists():
        errors.append(ValidationError(
            file_path=str(path),
            line_number=None,
            issue_type=IssueType.MISSING_FIELD,
            field_name=None,
            message=f"文件不存在: {file_path}",
        ))
        return fans, errors

    try:
        with open(path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            headers = reader.fieldnames or []

            if not headers:
                errors.append(ValidationError(
                    file_path=str(path),
                    line_number=1,
                    issue_type=IssueType.MISSING_FIELD,
                    field_name=None,
                    message="CSV文件没有表头",
                ))
                return fans, errors

            required_headers = ["fan_id", "fan_name", "rated_flow", "max_flow"]
            missing = [h for h in required_headers if h not in headers]

            if missing:
                errors.append(ValidationError(
                    file_path=str(path),
                    line_number=1,
                    issue_type=IssueType.MISSING_FIELD,
                    field_name=", ".join(missing),
                    message=f"缺少表头: {', '.join(missing)}",
                    raw_value=", ".join(headers),
                ))
                return fans, errors

            for line_num, row in enumerate(reader, start=2):
                try:
                    assigned_zones = []
                    if "assigned_zones" in row and row["assigned_zones"]:
                        assigned_zones = [z.strip() for z in row["assigned_zones"].split(",")]

                    fan = Fan(
                        fan_id=str(row["fan_id"]),
                        fan_name=str(row["fan_name"]),
                        rated_flow=float(row["rated_flow"].strip() or "0"),
                        max_flow=float(row["max_flow"].strip() or "0"),
                        assigned_zones=assigned_zones,
                    )
                    fans.append(fan)
                except (ValueError, TypeError) as e:
                    errors.append(ValidationError(
                        file_path=str(path),
                        line_number=line_num,
                        issue_type=IssueType.INVALID_VALUE,
                        field_name=None,
                        message=f"行数据无效: {str(e)}",
                        raw_value=str(row),
                    ))
    except Exception as e:
        errors.append(ValidationError(
            file_path=str(path),
            line_number=None,
            issue_type=IssueType.INVALID_VALUE,
            field_name=None,
            message=f"读取CSV文件错误: {str(e)}",
        ))

    return fans, errors


def read_damper_events(file_path: str) -> Tuple[List[DamperEvent], List[ValidationError]]:
    events = []
    errors = []
    path = Path(file_path)

    if not path.exists():
        errors.append(ValidationError(
            file_path=str(path),
            line_number=None,
            issue_type=IssueType.MISSING_FIELD,
            field_name=None,
            message=f"文件不存在: {file_path}",
        ))
        return events, errors

    try:
        with open(path, "r", encoding="utf-8") as f:
            for line_num, line in enumerate(f, start=1):
                line = line.strip()
                if not line:
                    continue

                try:
                    data = json.loads(line)
                except json.JSONDecodeError as e:
                    errors.append(ValidationError(
                        file_path=str(path),
                        line_number=line_num,
                        issue_type=IssueType.INVALID_VALUE,
                        field_name=None,
                        message=f"JSON解析错误: {str(e)}",
                        raw_value=line[:100] + "..." if len(line) > 100 else line,
                    ))
                    continue

                required_fields = ["damper_id", "event_time", "event_type"]
                missing = [f for f in required_fields if f not in data]

                if missing:
                    errors.append(ValidationError(
                        file_path=str(path),
                        line_number=line_num,
                        issue_type=IssueType.MISSING_FIELD,
                        field_name=", ".join(missing),
                        message=f"缺少字段: {', '.join(missing)}",
                        raw_value=line,
                    ))
                    continue

                try:
                    event_time = parse_datetime(str(data["event_time"]))
                except ValueError as e:
                    errors.append(ValidationError(
                        file_path=str(path),
                        line_number=line_num,
                        issue_type=IssueType.INVALID_VALUE,
                        field_name="event_time",
                        message=f"时间格式错误: {str(e)}",
                        raw_value=str(data.get("event_time")),
                    ))
                    continue

                try:
                    event = DamperEvent(
                        damper_id=str(data["damper_id"]),
                        event_time=event_time,
                        event_type=str(data["event_type"]),
                        zone_id=str(data["zone_id"]) if data.get("zone_id") else None,
                        raw_line=line,
                    )
                    events.append(event)
                except Exception as e:
                    errors.append(ValidationError(
                        file_path=str(path),
                        line_number=line_num,
                        issue_type=IssueType.INVALID_VALUE,
                        field_name=None,
                        message=f"创建事件对象失败: {str(e)}",
                        raw_value=line,
                    ))
    except Exception as e:
        errors.append(ValidationError(
            file_path=str(path),
            line_number=None,
            issue_type=IssueType.INVALID_VALUE,
            field_name=None,
            message=f"读取文件错误: {str(e)}",
        ))

    return events, errors


def read_sensor_minutes(file_path: str) -> Tuple[List[SensorMinute], List[ValidationError]]:
    sensor_data = []
    errors = []
    path = Path(file_path)

    if not path.exists():
        errors.append(ValidationError(
            file_path=str(path),
            line_number=None,
            issue_type=IssueType.MISSING_FIELD,
            field_name=None,
            message=f"文件不存在: {file_path}",
        ))
        return sensor_data, errors

    try:
        with open(path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            headers = reader.fieldnames or []

            if not headers:
                errors.append(ValidationError(
                    file_path=str(path),
                    line_number=1,
                    issue_type=IssueType.MISSING_FIELD,
                    field_name=None,
                    message="CSV文件没有表头",
                ))
                return sensor_data, errors

            required_headers = ["sensor_id", "timestamp"]
            missing = [h for h in required_headers if h not in headers]

            if missing:
                errors.append(ValidationError(
                    file_path=str(path),
                    line_number=1,
                    issue_type=IssueType.MISSING_FIELD,
                    field_name=", ".join(missing),
                    message=f"缺少表头: {', '.join(missing)}",
                    raw_value=", ".join(headers),
                ))
                return sensor_data, errors

            for line_num, row in enumerate(reader, start=2):
                try:
                    timestamp = parse_datetime(str(row["timestamp"]))
                except ValueError as e:
                    errors.append(ValidationError(
                        file_path=str(path),
                        line_number=line_num,
                        issue_type=IssueType.INVALID_VALUE,
                        field_name="timestamp",
                        message=f"时间格式错误: {str(e)}",
                        raw_value=str(row.get("timestamp")),
                    ))
                    continue

                def parse_float(val: str) -> Optional[float]:
                    val = str(val).strip()
                    if not val or val.lower() in ("null", "none", "na", ""):
                        return None
                    try:
                        return float(val)
                    except ValueError:
                        return None

                try:
                    sensor = SensorMinute(
                        sensor_id=str(row["sensor_id"]),
                        timestamp=timestamp,
                        co2=parse_float(row.get("co2", "")),
                        smoke=parse_float(row.get("smoke", "")),
                        temp=parse_float(row.get("temp", "")),
                    )
                    sensor_data.append(sensor)
                except Exception as e:
                    errors.append(ValidationError(
                        file_path=str(path),
                        line_number=line_num,
                        issue_type=IssueType.INVALID_VALUE,
                        field_name=None,
                        message=f"行数据无效: {str(e)}",
                        raw_value=str(row),
                    ))
    except Exception as e:
        errors.append(ValidationError(
            file_path=str(path),
            line_number=None,
            issue_type=IssueType.INVALID_VALUE,
            field_name=None,
            message=f"读取CSV文件错误: {str(e)}",
        ))

    return sensor_data, errors


def read_all_data(sample_dir: str) -> Tuple[Dict, List[ValidationError]]:
    all_errors = []

    zones, zone_errors = read_zones(f"{sample_dir}/zones.yaml")
    all_errors.extend(zone_errors)

    fans, fan_errors = read_fans(f"{sample_dir}/fans.csv")
    all_errors.extend(fan_errors)

    damper_events, damper_errors = read_damper_events(f"{sample_dir}/damper_events.jsonl")
    all_errors.extend(damper_errors)

    sensor_minutes, sensor_errors = read_sensor_minutes(f"{sample_dir}/sensor_minutes.csv")
    all_errors.extend(sensor_errors)

    return {
        "zones": zones,
        "fans": fans,
        "damper_events": damper_events,
        "sensor_minutes": sensor_minutes,
    }, all_errors

"""Data parsing module for mooring quality check."""

import csv
import json
from pathlib import Path
from typing import Any, List, Dict, Union
from datetime import datetime

import yaml


def parse_berth_plan(csv_path: Union[str, Path]) -> List[Dict[str, Any]]:
    """Parse berth plan CSV file.

    CSV format: vessel_name, berth_id, arrival_time, departure_time, max_tension_kn
    """
    records = []
    with open(csv_path, "r", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            records.append({
                "vessel_name": row["vessel_name"],
                "berth_id": row["berth_id"],
                "arrival_time": parse_datetime(row["arrival_time"]),
                "departure_time": parse_datetime(row["departure_time"]),
                "max_tension_kn": float(row.get("max_tension_kn", 500)),
            })
    return records


def parse_tidewind(json_path: Union[str, Path]) -> List[Dict[str, Any]]:
    """Parse tide and wind JSON file.

    JSON format: list of {timestamp, tide_m, wind_speed_kn, wind_dir_deg}
    """
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    records = []
    for item in data:
        records.append({
            "timestamp": parse_datetime(item["timestamp"]),
            "tide_m": float(item["tide_m"]),
            "wind_speed_kn": float(item["wind_speed_kn"]),
            "wind_dir_deg": float(item.get("wind_dir_deg", 0)),
        })
    return records


def parse_sensor_data(jsonl_path: Union[str, Path]) -> List[Dict[str, Any]]:
    """Parse sensor data JSONL file.

    JSONL format: {timestamp, sensor_id, tension_kn, unit}
    Handles kN and tonf units (1 tonf = 9.80665 kN)
    """
    records = []
    with open(jsonl_path, "r", encoding="utf-8") as f:
        for line in f:
            if line.strip():
                item = json.loads(line)
                unit = item.get("unit", "kN")
                tension_kn = item["tension_kn"]
                if unit == "tonf":
                    tension_kn = tension_kn * 9.80665
                records.append({
                    "timestamp": parse_datetime(item["timestamp"]),
                    "sensor_id": item["sensor_id"],
                    "tension_kn": tension_kn,
                    "unit": unit,
                })
    return records


def parse_vessel_rules(yaml_path: Union[str, Path]) -> Dict[str, Any]:
    """Parse vessel rules YAML file.

    YAML format: vessel type rules with tension limits and sensor thresholds
    """
    with open(yaml_path, "r", encoding="utf-8") as f:
        rules = yaml.safe_load(f)
    return rules


def parse_datetime(dt_str: str) -> datetime:
    """Parse datetime string in ISO format or common formats."""
    for fmt in ["%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%dT%H:%M:%S.%f"]:
        try:
            return datetime.strptime(dt_str, fmt)
        except ValueError:
            continue
    raise ValueError(f"Cannot parse datetime: {dt_str}")

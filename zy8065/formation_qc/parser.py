"""Parser module for reading channel_readings.csv, recipe.yaml and tray_map.json."""

import csv
import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

import yaml


class TimestampParser:
    @staticmethod
    def parse(value: str) -> datetime:
        for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%m/%d/%Y %H:%M:%S", "%d/%m/%Y %H:%M:%S"):
            try:
                return datetime.strptime(value.strip(), fmt)
            except ValueError:
                continue
        raise ValueError(f"Cannot parse timestamp: {value}")

    @staticmethod
    def fix_overnight(timestamps: list[datetime]) -> list[datetime]:
        result = []
        for i, ts in enumerate(timestamps):
            if i > 0 and ts < timestamps[i - 1]:
                result.append(ts + timedelta(days=1))
            else:
                if result:
                    prev = result[-1]
                    if ts < prev:
                        result.append(ts + timedelta(days=1))
                    else:
                        result.append(ts)
                else:
                    result.append(ts)
        return result


class ChannelReadingsParser:
    REQUIRED_COLUMNS = {"channel", "timestamp", "voltage", "current", "temperature", "capacity"}

    def __init__(self, filepath: str):
        self.filepath = Path(filepath)

    def parse(self) -> list[dict[str, Any]]:
        with open(self.filepath, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for col in self.REQUIRED_COLUMNS:
                if col not in reader.fieldnames:
                    raise ValueError(f"Missing required column: {col}")
            rows = list(reader)

        grouped: dict[int, list[dict]] = {}
        for row in rows:
            ch = int(row["channel"])
            grouped.setdefault(ch, []).append(row)

        result = []
        for ch, ch_rows in grouped.items():
            timestamps = [TimestampParser.parse(r["timestamp"]) for r in ch_rows]
            timestamps = TimestampParser.fix_overnight(timestamps)
            ch_rows_sorted = sorted(zip(timestamps, ch_rows), key=lambda x: x[0])
            result.append({
                "channel": ch,
                "data": [
                    {
                        "timestamp": ts,
                        "voltage": float(r["voltage"]),
                        "current": float(r["current"]),
                        "temperature": float(r["temperature"]),
                        "capacity": float(r["capacity"]),
                    }
                    for ts, r in ch_rows_sorted
                ],
            })
        return result


class RecipeParser:
    def __init__(self, filepath: str):
        self.filepath = Path(filepath)

    def parse(self) -> dict[str, Any]:
        with open(self.filepath, encoding="utf-8") as f:
            data = yaml.safe_load(f)
        return {
            "stages": data.get("stages", []),
            "sampling_interval": data.get("sampling_interval", 10),
            "voltage_threshold": data.get("voltage_threshold", {}),
            "current_threshold": data.get("current_threshold", {}),
            "temperature_threshold": data.get("temperature_threshold", {}),
            "capacity_threshold": data.get("capacity_threshold", {}),
        }


class TrayMapParser:
    def __init__(self, filepath: str):
        self.filepath = Path(filepath)

    def parse(self) -> dict[int, dict[str, Any]]:
        with open(self.filepath, encoding="utf-8") as f:
            data = json.load(f)
        result = {}
        for item in data.get("trays", []):
            for cell in item.get("cells", []):
                ch = cell.get("channel")
                if ch is not None:
                    result[int(ch)] = {
                        "tray_id": item.get("tray_id"),
                        "position": cell.get("position"),
                        "type": cell.get("type"),
                    }
        return result

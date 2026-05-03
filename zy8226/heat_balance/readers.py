import csv
import json
import yaml
from typing import Dict, List, Any
from datetime import datetime
from pathlib import Path

from .models import (
    BuildingUnit,
    ValveSetting,
    SensorReading,
    WeatherLoadPoint,
    AnomalyType,
)


class DataReader:
    def __init__(self):
        self.anomalies: List[Dict[str, Any]] = []

    def read_topology(self, filepath: str) -> Dict[str, BuildingUnit]:
        units: Dict[str, BuildingUnit] = {}
        parent_children_map: Dict[str, List[str]] = {}

        with open(filepath, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                unit_id = row["unit_id"].strip()
                parent_id = row.get("parent_id", "").strip() or None

                unit = BuildingUnit(
                    unit_id=unit_id,
                    name=row.get("name", unit_id),
                    parent_id=parent_id,
                    unit_type=row.get("unit_type", "apartment"),
                    design_flow=float(row.get("design_flow", 0) or 0),
                    design_heat_load=float(row.get("design_heat_load", 0) or 0),
                    valve_id=row.get("valve_id", "").strip() or None,
                )
                units[unit_id] = unit

                if parent_id:
                    if parent_id not in parent_children_map:
                        parent_children_map[parent_id] = []
                    parent_children_map[parent_id].append(unit_id)

        for parent_id, children in parent_children_map.items():
            if parent_id in units:
                units[parent_id].children = children

        return units

    def read_valve_settings(self, filepath: str) -> Dict[str, ValveSetting]:
        valves: Dict[str, ValveSetting] = {}

        with open(filepath, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)

        if "valves" not in data:
            raise ValueError(f"YAML 文件 {filepath} 缺少 'valves' 根节点")

        for valve_data in data["valves"]:
            valve_id = valve_data["valve_id"].strip()
            current_open = float(valve_data.get("current_open_rate", 50.0))
            min_open = float(valve_data.get("min_open_rate", 0.0))
            max_open = float(valve_data.get("max_open_rate", 100.0))

            if current_open < min_open or current_open > max_open:
                self.anomalies.append(
                    {
                        "type": AnomalyType.VALVE_OUT_OF_BOUNDS.value,
                        "valve_id": valve_id,
                        "unit_id": valve_data.get("unit_id", ""),
                        "current_value": current_open,
                        "min_bound": min_open,
                        "max_bound": max_open,
                        "message": f"阀门开度 {current_open}% 超出范围 [{min_open}%, {max_open}%]",
                    }
                )

            valve = ValveSetting(
                valve_id=valve_id,
                unit_id=valve_data.get("unit_id", "").strip(),
                current_open_rate=current_open,
                min_open_rate=min_open,
                max_open_rate=max_open,
                is_enabled=valve_data.get("is_enabled", True),
            )
            valves[valve_id] = valve

        return valves

    def read_sensor_data(self, filepath: str) -> List[SensorReading]:
        readings: List[SensorReading] = []

        with open(filepath, "r", encoding="utf-8") as f:
            for line_num, line in enumerate(f, 1):
                line = line.strip()
                if not line:
                    continue

                try:
                    data = json.loads(line)
                except json.JSONDecodeError:
                    self.anomalies.append(
                        {
                            "type": "parse_error",
                            "line": line_num,
                            "message": f"JSON 解析错误在第 {line_num} 行",
                        }
                    )
                    continue

                unit_id = data.get("unit_id", "").strip()
                if not unit_id:
                    continue

                ts_str = data.get("timestamp", "")
                try:
                    timestamp = self._parse_timestamp(ts_str)
                except ValueError:
                    self.anomalies.append(
                        {
                            "type": "timestamp_error",
                            "unit_id": unit_id,
                            "raw_value": ts_str,
                            "message": f"无法解析时间戳: {ts_str}",
                        }
                    )
                    continue

                supply_temp = self._safe_float(data.get("supply_temp"))
                return_temp = self._safe_float(data.get("return_temp"))
                flow_rate = self._safe_float(data.get("flow_rate"))

                is_valid = True
                anomalies_for_reading = []

                if supply_temp is None or return_temp is None or flow_rate is None:
                    is_valid = False
                    missing_fields = []
                    if supply_temp is None:
                        missing_fields.append("supply_temp")
                    if return_temp is None:
                        missing_fields.append("return_temp")
                    if flow_rate is None:
                        missing_fields.append("flow_rate")

                    anomalies_for_reading.append(
                        {
                            "type": AnomalyType.SENSOR_MISSING.value,
                            "unit_id": unit_id,
                            "timestamp": timestamp.isoformat(),
                            "missing_fields": missing_fields,
                            "message": f"传感器数据缺失: {', '.join(missing_fields)}",
                        }
                    )

                if return_temp is not None and supply_temp is not None:
                    if return_temp > supply_temp:
                        is_valid = False
                        anomalies_for_reading.append(
                            {
                                "type": AnomalyType.TEMPERATURE_INVERSION.value,
                                "unit_id": unit_id,
                                "timestamp": timestamp.isoformat(),
                                "supply_temp": supply_temp,
                                "return_temp": return_temp,
                                "message": f"回水温度 ({return_temp}°C) 高于供水温度 ({supply_temp}°C)",
                            }
                        )

                if flow_rate is not None and flow_rate < 0:
                    is_valid = False
                    anomalies_for_reading.append(
                        {
                            "type": AnomalyType.NEGATIVE_FLOW.value,
                            "unit_id": unit_id,
                            "timestamp": timestamp.isoformat(),
                            "flow_rate": flow_rate,
                            "message": f"流量为负值: {flow_rate}",
                        }
                    )

                self.anomalies.extend(anomalies_for_reading)

                reading = SensorReading(
                    unit_id=unit_id,
                    timestamp=timestamp,
                    supply_temp=supply_temp,
                    return_temp=return_temp,
                    flow_rate=flow_rate,
                    is_valid=is_valid,
                )
                readings.append(reading)

        return readings

    def read_weather_load(self, filepath: str) -> List[WeatherLoadPoint]:
        points: List[WeatherLoadPoint] = []

        with open(filepath, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                ts_str = row.get("timestamp", "").strip()
                if not ts_str:
                    continue

                try:
                    timestamp = self._parse_timestamp(ts_str)
                except ValueError:
                    continue

                point = WeatherLoadPoint(
                    timestamp=timestamp,
                    outdoor_temp=float(row.get("outdoor_temp", 0) or 0),
                    design_load_ratio=float(row.get("design_load_ratio", 1.0) or 1.0),
                    ambient_heat_loss_factor=float(row.get("heat_loss_factor", 1.0) or 1.0),
                )
                points.append(point)

        points.sort(key=lambda p: p.timestamp)
        return points

    def _parse_timestamp(self, ts_str: str) -> datetime:
        formats = [
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%d %H:%M",
            "%Y-%m-%dT%H:%M",
            "%Y/%m/%d %H:%M:%S",
            "%Y/%m/%d %H:%M",
        ]

        for fmt in formats:
            try:
                return datetime.strptime(ts_str.strip(), fmt)
            except ValueError:
                continue

        return datetime.fromisoformat(ts_str)

    def _safe_float(self, value) -> Optional[float]:
        if value is None:
            return None
        if isinstance(value, float):
            return value
        if isinstance(value, int):
            return float(value)
        if isinstance(value, str):
            value = value.strip()
            if value in ["", "NA", "N/A", "null", "NaN"]:
                return None
            try:
                return float(value)
            except ValueError:
                return None
        return None

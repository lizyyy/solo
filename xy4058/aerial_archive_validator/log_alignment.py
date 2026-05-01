from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
import csv
import json
import re

from .config import (
    FlightLogEntry,
    WaypointPlanEntry,
    MaterialMetadata,
    DeliveryListItem,
    ProjectConfig,
)
from .exceptions import LogParsingError


class CSVColumnMapping:
    DJI_LOG_COLUMNS = {
        "timestamp": ["timestamp", "时间戳", "time", "datetime", "date_time"],
        "latitude": ["latitude", "纬度", "lat"],
        "longitude": ["longitude", "经度", "lon", "lng"],
        "altitude_meters": ["altitude", "高度", "alt", "relative_altitude"],
        "velocity_x": ["velocity_x", "vx", "x速度"],
        "velocity_y": ["velocity_y", "vy", "y速度"],
        "velocity_z": ["velocity_z", "vz", "z速度"],
        "gimbal_yaw": ["gimbal_yaw", "云台偏航", "yaw"],
        "gimbal_pitch": ["gimbal_pitch", "云台俯仰", "pitch"],
        "gimbal_roll": ["gimbal_roll", "云台横滚", "roll"],
        "battery_percentage": ["battery", "电池", "battery_percent"],
        "satellite_count": ["satellite", "卫星", "sat_count", "gps_satellites"],
        "flight_mode": ["flight_mode", "飞行模式", "mode"],
        "flight_line": ["flight_line", "航线", "line", "航线编号"],
        "waypoint_number": ["waypoint", "航点", "wp", "waypoint_number"],
    }


class FlightLogParser:
    @staticmethod
    def _try_parse_datetime(value: str) -> Optional[datetime]:
        if not value or not value.strip():
            return None

        value = value.strip()

        patterns = [
            "%Y-%m-%d %H:%M:%S.%f",
            "%Y-%m-%d %H:%M:%S",
            "%Y/%m/%d %H:%M:%S",
            "%Y-%m-%dT%H:%M:%S.%fZ",
            "%Y-%m-%dT%H:%M:%SZ",
            "%Y%m%d_%H%M%S",
            "%Y:%m:%d %H:%M:%S",
        ]

        for pattern in patterns:
            try:
                return datetime.strptime(value, pattern)
            except ValueError:
                continue

        try:
            from dateutil import parser
            return parser.parse(value)
        except Exception:
            pass

        return None

    @staticmethod
    def _try_parse_float(value: Any) -> Optional[float]:
        if value is None or value == "":
            return None
        try:
            return float(str(value).strip())
        except (ValueError, TypeError):
            return None

    @staticmethod
    def _try_parse_int(value: Any) -> Optional[int]:
        if value is None or value == "":
            return None
        try:
            return int(str(value).strip())
        except (ValueError, TypeError):
            return None

    @classmethod
    def parse_csv(cls, csv_path: Path) -> List[FlightLogEntry]:
        entries: List[FlightLogEntry] = []

        try:
            with open(csv_path, "r", encoding="utf-8-sig") as f:
                content = f.read()

            content = content.replace("\x00", "")

            import io
            csv_reader = csv.DictReader(io.StringIO(content))

            if csv_reader.fieldnames is None:
                raise LogParsingError("CSV文件没有表头行", str(csv_path))

            field_map = cls._map_fields(list(csv_reader.fieldnames))

            for row_idx, row in enumerate(csv_reader, start=2):
                try:
                    entry = cls._parse_row(row, field_map, row_idx)
                    if entry:
                        entries.append(entry)
                except Exception as e:
                    raise LogParsingError(f"解析CSV第{row_idx}行失败: {e}", str(csv_path))

        except FileNotFoundError:
            raise LogParsingError(f"日志文件不存在: {csv_path}", str(csv_path))
        except csv.Error as e:
            raise LogParsingError(f"CSV解析错误: {e}", str(csv_path))
        except Exception as e:
            if not isinstance(e, LogParsingError):
                raise LogParsingError(f"解析飞行日志失败: {e}", str(csv_path))
            raise

        entries.sort(key=lambda x: x.timestamp)
        return entries

    @classmethod
    def _map_fields(cls, header_fields: List[str]) -> Dict[str, str]:
        field_map: Dict[str, str] = {}
        header_lower = {h.strip().lower(): h for h in header_fields}

        for target_field, possible_names in CSVColumnMapping.DJI_LOG_COLUMNS.items():
            for name in possible_names:
                name_lower = name.lower()
                if name_lower in header_lower:
                    field_map[target_field] = header_lower[name_lower]
                    break

        return field_map

    @classmethod
    def _parse_row(
        cls, row: Dict[str, str], field_map: Dict[str, str], row_number: int
    ) -> Optional[FlightLogEntry]:
        timestamp_str = row.get(field_map.get("timestamp", "timestamp"), "")
        if not timestamp_str:
            for key in row.keys():
                if any(kw in key.lower() for kw in ["time", "date", "timestamp"]):
                    timestamp_str = row.get(key, "")
                    if timestamp_str:
                        break

        timestamp = cls._try_parse_datetime(timestamp_str)
        if timestamp is None:
            return None

        lat_str = row.get(field_map.get("latitude", "latitude"), "")
        lon_str = row.get(field_map.get("longitude", "longitude"), "")

        if not lat_str or not lon_str:
            for key in row.keys():
                key_lower = key.lower()
                if "lat" in key_lower and "lon" not in key_lower:
                    lat_str = row.get(key, "") or lat_str
                elif "lon" in key_lower or "lng" in key_lower:
                    lon_str = row.get(key, "") or lon_str

        latitude = cls._try_parse_float(lat_str)
        longitude = cls._try_parse_float(lon_str)

        if latitude is None or longitude is None:
            return None

        entry = FlightLogEntry(
            timestamp=timestamp,
            latitude=latitude,
            longitude=longitude,
        )

        entry.altitude_meters = cls._try_parse_float(
            row.get(field_map.get("altitude_meters", "altitude_meters"))
        )

        entry.velocity_x = cls._try_parse_float(
            row.get(field_map.get("velocity_x", "velocity_x"))
        )
        entry.velocity_y = cls._try_parse_float(
            row.get(field_map.get("velocity_y", "velocity_y"))
        )
        entry.velocity_z = cls._try_parse_float(
            row.get(field_map.get("velocity_z", "velocity_z"))
        )

        entry.gimbal_yaw = cls._try_parse_float(
            row.get(field_map.get("gimbal_yaw", "gimbal_yaw"))
        )
        entry.gimbal_pitch = cls._try_parse_float(
            row.get(field_map.get("gimbal_pitch", "gimbal_pitch"))
        )
        entry.gimbal_roll = cls._try_parse_float(
            row.get(field_map.get("gimbal_roll", "gimbal_roll"))
        )

        entry.battery_percentage = cls._try_parse_float(
            row.get(field_map.get("battery_percentage", "battery_percentage"))
        )
        entry.satellite_count = cls._try_parse_int(
            row.get(field_map.get("satellite_count", "satellite_count"))
        )

        flight_mode_val = row.get(field_map.get("flight_mode", "flight_mode"))
        if flight_mode_val:
            entry.flight_mode = str(flight_mode_val).strip()

        entry.flight_line = cls._try_parse_int(
            row.get(field_map.get("flight_line", "flight_line"))
        )
        entry.waypoint_number = cls._try_parse_int(
            row.get(field_map.get("waypoint_number", "waypoint_number"))
        )

        return entry


class WaypointPlanParser:
    @staticmethod
    def parse_json(json_path: Path) -> List[WaypointPlanEntry]:
        entries: List[WaypointPlanEntry] = []

        try:
            with open(json_path, "r", encoding="utf-8") as f:
                data = json.load(f)

            waypoints = data.get("waypoints", [])
            if not isinstance(waypoints, list):
                if isinstance(data, list):
                    waypoints = data
                else:
                    waypoints = [data]

            for idx, wp_data in enumerate(waypoints):
                entry = WaypointPlanParser._parse_waypoint(wp_data, idx)
                if entry:
                    entries.append(entry)

        except FileNotFoundError:
            raise LogParsingError(f"航点计划文件不存在: {json_path}", str(json_path))
        except json.JSONDecodeError as e:
            raise LogParsingError(f"JSON解析错误: {e}", str(json_path))
        except Exception as e:
            if not isinstance(e, LogParsingError):
                raise LogParsingError(f"解析航点计划失败: {e}", str(json_path))
            raise

        return entries

    @staticmethod
    def _parse_waypoint(wp_data: Dict[str, Any], index: int) -> Optional[WaypointPlanEntry]:
        latitude = None
        longitude = None
        altitude = None

        for key in ["latitude", "lat", "纬度"]:
            if key in wp_data:
                try:
                    latitude = float(wp_data[key])
                    break
                except (ValueError, TypeError):
                    pass

        for key in ["longitude", "longitude", "lon", "lng", "经度"]:
            if key in wp_data:
                try:
                    longitude = float(wp_data[key])
                    break
                except (ValueError, TypeError):
                    pass

        for key in ["altitude", "alt", "高度", "altitude_meters"]:
            if key in wp_data:
                try:
                    altitude = float(wp_data[key])
                    break
                except (ValueError, TypeError):
                    pass

        if latitude is None or longitude is None or altitude is None:
            return None

        waypoint_id = index
        for key in ["waypoint_id", "id", "index", "航点编号"]:
            if key in wp_data:
                try:
                    waypoint_id = int(wp_data[key])
                    break
                except (ValueError, TypeError):
                    pass

        entry = WaypointPlanEntry(
            waypoint_id=waypoint_id,
            latitude=latitude,
            longitude=longitude,
            altitude_meters=altitude,
        )

        for key in ["gimbal_pitch", "pitch", "云台俯仰"]:
            if key in wp_data:
                try:
                    entry.gimbal_pitch = float(wp_data[key])
                    break
                except (ValueError, TypeError):
                    pass

        for key in ["gimbal_yaw", "yaw", "云台偏航"]:
            if key in wp_data:
                try:
                    entry.gimbal_yaw = float(wp_data[key])
                    break
                except (ValueError, TypeError):
                    pass

        for key in ["speed", "speed_mps", "速度"]:
            if key in wp_data:
                try:
                    entry.speed_mps = float(wp_data[key])
                    break
                except (ValueError, TypeError):
                    pass

        for key in ["hold_time", "hold_time_seconds", "停留时间"]:
            if key in wp_data:
                try:
                    entry.hold_time_seconds = float(wp_data[key])
                    break
                except (ValueError, TypeError):
                    pass

        for key in ["action_type", "action", "动作类型"]:
            if key in wp_data:
                entry.action_type = str(wp_data[key]).strip()
                break

        for key in ["flight_line", "line", "航线编号"]:
            if key in wp_data:
                try:
                    entry.flight_line = int(wp_data[key])
                    break
                except (ValueError, TypeError):
                    pass

        return entry


class DeliveryListParser:
    @staticmethod
    def parse_csv(csv_path: Path) -> List[DeliveryListItem]:
        items: List[DeliveryListItem] = []

        try:
            with open(csv_path, "r", encoding="utf-8-sig") as f:
                content = f.read()

            import io
            csv_reader = csv.DictReader(io.StringIO(content))

            if csv_reader.fieldnames is None:
                for row in csv.reader(io.StringIO(content)):
                    if row and len(row) > 0:
                        item = DeliveryListItem(file_name=str(row[0]).strip())
                        if len(row) > 1:
                            item.shooting_time = FlightLogParser._try_parse_datetime(row[1])
                        if len(row) > 2:
                            item.location = str(row[2]).strip() if row[2] else None
                        if len(row) > 3:
                            item.notes = str(row[3]).strip() if row[3] else None
                        items.append(item)
                return items

            for row in csv_reader:
                file_name = ""
                for key in row.keys():
                    key_lower = key.lower()
                    if "file" in key_lower or "name" in key_lower or "文件名" in key_lower:
                        file_name = str(row.get(key, "")).strip()
                        break

                if not file_name:
                    for key in row.keys():
                        val = str(row.get(key, "")).strip()
                        if val:
                            file_name = val
                            break

                if not file_name:
                    continue

                item = DeliveryListItem(file_name=file_name)

                for key in row.keys():
                    key_lower = key.lower()
                    if "time" in key_lower or "date" in key_lower or "拍摄" in key_lower:
                        time_val = row.get(key)
                        if time_val:
                            item.shooting_time = FlightLogParser._try_parse_datetime(time_val)
                            break

                for key in row.keys():
                    key_lower = key.lower()
                    if "location" in key_lower or "地点" in key_lower:
                        loc_val = row.get(key)
                        if loc_val:
                            item.location = str(loc_val).strip()
                            break

                for key in row.keys():
                    key_lower = key.lower()
                    if "note" in key_lower or "remark" in key_lower or "备注" in key_lower:
                        note_val = row.get(key)
                        if note_val:
                            item.notes = str(note_val).strip()
                            break

                items.append(item)

        except FileNotFoundError:
            raise LogParsingError(f"交付清单文件不存在: {csv_path}", str(csv_path))
        except Exception as e:
            if not isinstance(e, LogParsingError):
                raise LogParsingError(f"解析交付清单失败: {e}", str(csv_path))
            raise

        return items

    @staticmethod
    def parse_txt(txt_path: Path) -> List[DeliveryListItem]:
        items: List[DeliveryListItem] = []

        try:
            with open(txt_path, "r", encoding="utf-8") as f:
                lines = f.readlines()

            for line in lines:
                line = line.strip()
                if not line or line.startswith("#") or line.startswith("//"):
                    continue

                parts = line.split("\t") if "\t" in line else line.split(",")

                file_name = parts[0].strip()
                if not file_name:
                    continue

                item = DeliveryListItem(file_name=file_name)

                if len(parts) > 1:
                    item.shooting_time = FlightLogParser._try_parse_datetime(parts[1])
                if len(parts) > 2:
                    item.location = parts[2].strip() if parts[2].strip() else None
                if len(parts) > 3:
                    item.notes = parts[3].strip() if parts[3].strip() else None

                items.append(item)

        except FileNotFoundError:
            raise LogParsingError(f"交付清单文件不存在: {txt_path}", str(txt_path))
        except Exception as e:
            if not isinstance(e, LogParsingError):
                raise LogParsingError(f"解析交付清单失败: {e}", str(txt_path))
            raise

        return items


class LogAligner:
    def __init__(self, config: ProjectConfig) -> None:
        self.config = config
        self.flight_logs: List[FlightLogEntry] = []
        self.waypoint_plans: List[WaypointPlanEntry] = []
        self.delivery_list: List[DeliveryListItem] = []
        self._time_index: Dict[datetime, FlightLogEntry] = {}
        self._sorted_timestamps: List[datetime] = []

    def add_flight_logs(self, entries: List[FlightLogEntry]) -> None:
        self.flight_logs.extend(entries)
        self.flight_logs.sort(key=lambda x: x.timestamp)
        self._rebuild_time_index()

    def add_waypoint_plans(self, entries: List[WaypointPlanEntry]) -> None:
        self.waypoint_plans.extend(entries)

    def add_delivery_list(self, items: List[DeliveryListItem]) -> None:
        self.delivery_list.extend(items)

    def _rebuild_time_index(self) -> None:
        self._time_index = {}
        self._sorted_timestamps = []

        for entry in self.flight_logs:
            if entry.timestamp not in self._time_index:
                self._time_index[entry.timestamp] = entry

        self._sorted_timestamps = sorted(self._time_index.keys())

    def find_nearest_log_entry(
        self, timestamp: datetime, threshold_seconds: Optional[float] = None
    ) -> Optional[Tuple[FlightLogEntry, float]]:
        if not self._sorted_timestamps:
            return None

        if threshold_seconds is None:
            threshold_seconds = self.config.time_sync_threshold_seconds

        import bisect
        idx = bisect.bisect_left(self._sorted_timestamps, timestamp)

        candidates: List[int] = []
        if idx < len(self._sorted_timestamps):
            candidates.append(idx)
        if idx > 0:
            candidates.append(idx - 1)

        best_match: Optional[Tuple[FlightLogEntry, float]] = None
        best_diff = float("inf")

        for candidate_idx in candidates:
            if 0 <= candidate_idx < len(self._sorted_timestamps):
                candidate_time = self._sorted_timestamps[candidate_idx]
                time_diff = abs((candidate_time - timestamp).total_seconds())

                if time_diff <= threshold_seconds and time_diff < best_diff:
                    best_diff = time_diff
                    best_match = (self._time_index[candidate_time], time_diff)

        return best_match

    def find_nearest_waypoint(
        self, latitude: float, longitude: float, threshold_meters: Optional[float] = None
    ) -> Optional[Tuple[WaypointPlanEntry, float]]:
        if not self.waypoint_plans:
            return None

        if threshold_meters is None:
            threshold_meters = self.config.coordinate_deviation_threshold_meters

        best_match: Optional[Tuple[WaypointPlanEntry, float]] = None
        best_distance = float("inf")

        for waypoint in self.waypoint_plans:
            distance = self._haversine_distance(
                latitude, longitude,
                waypoint.latitude, waypoint.longitude
            )

            if distance <= threshold_meters and distance < best_distance:
                best_distance = distance
                best_match = (waypoint, distance)

        return best_match

    @staticmethod
    def _haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        import math

        R = 6371000

        lat1_rad = math.radians(lat1)
        lat2_rad = math.radians(lat2)
        lon1_rad = math.radians(lon1)
        lon2_rad = math.radians(lon2)

        dlat = lat2_rad - lat1_rad
        dlon = lon2_rad - lon1_rad

        a = (
            math.sin(dlat / 2) ** 2
            + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon / 2) ** 2
        )
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

        return R * c

    def align_material(
        self, material: MaterialMetadata
    ) -> Dict[str, Any]:
        result: Dict[str, Any] = {
            "material_metadata": material,
            "matched_flight_log": None,
            "time_diff_seconds": None,
            "matched_waypoint": None,
            "distance_meters": None,
            "flight_line": material.flight_line,
            "waypoint_number": material.waypoint_number,
        }

        if material.capture_time:
            log_match = self.find_nearest_log_entry(material.capture_time)
            if log_match:
                result["matched_flight_log"] = log_match[0]
                result["time_diff_seconds"] = log_match[1]

                if log_match[0].flight_line is not None:
                    result["flight_line"] = log_match[0].flight_line
                if log_match[0].waypoint_number is not None:
                    result["waypoint_number"] = log_match[0].waypoint_number

        if material.is_valid_geolocation():
            waypoint_match = self.find_nearest_waypoint(
                material.latitude or 0,
                material.longitude or 0
            )
            if waypoint_match:
                result["matched_waypoint"] = waypoint_match[0]
                result["distance_meters"] = waypoint_match[1]

        return result

    def get_delivery_list_filenames(self) -> Set[str]:
        return {item.file_name for item in self.delivery_list}

    def get_flight_time_range(self) -> Optional[Tuple[datetime, datetime]]:
        if not self.flight_logs:
            return None

        return (
            min(entry.timestamp for entry in self.flight_logs),
            max(entry.timestamp for entry in self.flight_logs),
        )

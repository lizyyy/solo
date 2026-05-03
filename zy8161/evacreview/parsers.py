import csv
import json
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

import yaml


@dataclass
class Floor:
    number: int
    name: str
    exits: List[str]
    stairwells: List[str]
    cameras: List[str]


@dataclass
class Badge:
    badge_id: str
    name: str
    department: str
    role: str
    floor: int
    phone: Optional[str] = None
    email: Optional[str] = None

    def required_fields(self) -> List[str]:
        return ["badge_id", "name", "department", "role", "floor"]

    def missing_fields(self) -> List[str]:
        missing = []
        for f in self.required_fields():
            if not getattr(self, f):
                missing.append(f)
        return missing


@dataclass
class Event:
    timestamp: datetime
    badge_id: str
    location: str
    event_type: str
    direction: Optional[str] = None
    details: Dict[str, Any] = field(default_factory=dict)

    @property
    def floor(self) -> Optional[int]:
        if "floor" in self.details:
            return self.details["floor"]
        for part in self.location.split():
            if part.replace("F", "").isdigit() and "F" in part:
                return int(part.replace("F", ""))
        return None


@dataclass
class Checkpoint:
    name: str
    location: str
    floor: int
    type: str
    is_exit: bool = False
    is_meeting_point: bool = False


class ParseError(Exception):
    pass


class DataValidationWarning(Warning):
    pass


class Parser:
    DATE_FORMATS = [
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%m/%d/%Y %H:%M:%S",
        "%d/%m/%Y %H:%M:%S",
    ]

    @staticmethod
    def parse_datetime(value: str) -> datetime:
        value = value.strip()
        for fmt in Parser.DATE_FORMATS:
            try:
                return datetime.strptime(value, fmt)
            except ValueError:
                continue
        raise ParseError(f"无法解析时间格式: {value}")

    @staticmethod
    def check_midnight_crossing(events: List[Event]) -> Tuple[bool, str]:
        if not events:
            return False, ""
        timestamps = [e.timestamp for e in events]
        min_ts, max_ts = min(timestamps), max(timestamps)
        if min_ts.date() != max_ts.date():
            days = (max_ts.date() - min_ts.date()).days
            return True, f"事件跨越 {days} 天，从 {min_ts.date()} 到 {max_ts.date()}"
        return False, ""

    @staticmethod
    def parse_floors(file_path: Path) -> Dict[int, Floor]:
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = yaml.safe_load(f)
        except Exception as e:
            raise ParseError(f"读取 floors.yaml 失败: {e}")

        floors = {}
        if not isinstance(data, dict) or "floors" not in data:
            raise ParseError("floors.yaml 格式错误，缺少 'floors' 键")

        for floor_data in data["floors"]:
            try:
                floor = Floor(
                    number=floor_data["number"],
                    name=floor_data.get("name", f"{floor_data['number']}F"),
                    exits=floor_data.get("exits", []),
                    stairwells=floor_data.get("stairwells", []),
                    cameras=floor_data.get("cameras", []),
                )
                floors[floor.number] = floor
            except KeyError as e:
                raise ParseError(f"楼层数据缺少必需字段: {e}")
        return floors

    @staticmethod
    def parse_badges(file_path: Path) -> Dict[str, Badge]:
        badges = {}
        warnings = []

        try:
            with open(file_path, "r", encoding="utf-8-sig") as f:
                reader = csv.DictReader(f)
                for row_num, row in enumerate(reader, start=2):
                    try:
                        badge = Badge(
                            badge_id=row.get("badge_id", "").strip(),
                            name=row.get("name", "").strip(),
                            department=row.get("department", "").strip(),
                            role=row.get("role", "").strip(),
                            floor=int(row["floor"].strip()) if row.get("floor", "").strip() else 0,
                            phone=row.get("phone", "").strip() or None,
                            email=row.get("email", "").strip() or None,
                        )
                        missing = badge.missing_fields()
                        if missing:
                            warnings.append(f"第 {row_num} 行 (badge_id={badge.badge_id}) 缺少字段: {', '.join(missing)}")
                        if badge.badge_id:
                            badges[badge.badge_id] = badge
                    except ValueError as e:
                        raise ParseError(f"第 {row_num} 行数据格式错误: {e}")
        except Exception as e:
            raise ParseError(f"读取 badges.csv 失败: {e}")

        if warnings:
            for w in warnings:
                import warnings as ww
                ww.warn(DataValidationWarning(w))

        return badges

    @staticmethod
    def parse_events(file_path: Path) -> List[Event]:
        events = []
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                for line_num, line in enumerate(f, start=1):
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        data = json.loads(line)
                        event = Event(
                            timestamp=Parser.parse_datetime(data["timestamp"]),
                            badge_id=data.get("badge_id", "").strip(),
                            location=data.get("location", "").strip(),
                            event_type=data.get("event_type", "unknown").strip().lower(),
                            direction=data.get("direction", "").strip().lower() or None,
                            details=data.get("details", {}),
                        )
                        events.append(event)
                    except (json.JSONDecodeError, KeyError) as e:
                        raise ParseError(f"第 {line_num} 行解析失败: {e}")
        except Exception as e:
            raise ParseError(f"读取 events.jsonl 失败: {e}")

        midnight_warning, msg = Parser.check_midnight_crossing(events)
        if midnight_warning:
            import warnings as ww
            ww.warn(DataValidationWarning(f"检测到跨午夜事件: {msg}"))

        return sorted(events, key=lambda e: e.timestamp)

    @staticmethod
    def parse_checkpoints(file_path: Path) -> Dict[str, Checkpoint]:
        checkpoints = {}
        try:
            with open(file_path, "r", encoding="utf-8-sig") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    try:
                        checkpoint = Checkpoint(
                            name=row["name"].strip(),
                            location=row.get("location", "").strip(),
                            floor=int(row["floor"].strip()),
                            type=row.get("type", "checkpoint").strip().lower(),
                            is_exit=row.get("is_exit", "").strip().lower() in ["true", "1", "yes"],
                            is_meeting_point=row.get("is_meeting_point", "").strip().lower() in ["true", "1", "yes"],
                        )
                        checkpoints[checkpoint.name] = checkpoint
                    except KeyError as e:
                        raise ParseError(f"checkpoints.csv 缺少字段: {e}")
                    except ValueError as e:
                        raise ParseError(f"checkpoints.csv 数据格式错误: {e}")
        except Exception as e:
            raise ParseError(f"读取 checkpoints.csv 失败: {e}")
        return checkpoints


class Dataset:
    def __init__(
        self,
        floors: Dict[int, Floor],
        badges: Dict[str, Badge],
        events: List[Event],
        checkpoints: Dict[str, Checkpoint],
    ):
        self.floors = floors
        self.badges = badges
        self.events = events
        self.checkpoints = checkpoints

    @property
    def meeting_points(self) -> List[Checkpoint]:
        return [cp for cp in self.checkpoints.values() if cp.is_meeting_point]

    @property
    def exits(self) -> List[Checkpoint]:
        return [cp for cp in self.checkpoints.values() if cp.is_exit]

    def get_badge(self, badge_id: str) -> Optional[Badge]:
        return self.badges.get(badge_id)

    def get_floor_events(self, floor: int) -> List[Event]:
        return [e for e in self.events if e.floor == floor]

    def get_person_events(self, badge_id: str) -> List[Event]:
        return [e for e in self.events if e.badge_id == badge_id]

    @property
    def unique_badge_ids(self) -> Set[str]:
        badge_set = set(self.badges.keys())
        event_set = {e.badge_id for e in self.events if e.badge_id}
        return badge_set.union(event_set)


def load_dataset(
    floors_path: Path,
    badges_path: Path,
    events_path: Path,
    checkpoints_path: Path,
) -> Dataset:
    floors = Parser.parse_floors(floors_path)
    badges = Parser.parse_badges(badges_path)
    events = Parser.parse_events(events_path)
    checkpoints = Parser.parse_checkpoints(checkpoints_path)
    return Dataset(floors, badges, events, checkpoints)

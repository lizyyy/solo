import json
import csv
from pathlib import Path
from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, validator
from enum import Enum


class Direction(str, Enum):
    IN = "in"
    OUT = "out"
    UNKNOWN = "unknown"


class EventType(str, Enum):
    SWIPE = "swipe"
    DENY = "deny"
    ALARM = "alarm"


class CardSwipeEvent(BaseModel):
    device_id: str
    card_id: str
    timestamp: datetime
    zone_id: str
    direction: Direction = Direction.UNKNOWN
    event_type: EventType = EventType.SWIPE
    raw_timestamp: str = ""
    source_file: str = ""
    
    @validator("timestamp", pre=True)
    def parse_timestamp(cls, v):
        if isinstance(v, str):
            for fmt in ["%Y-%m-%d %H:%M:%S", "%Y%m%d%H%M%S", "%Y-%m-%dT%H:%M:%S"]:
                try:
                    return datetime.strptime(v, fmt)
                except ValueError:
                    continue
            raise ValueError(f"无法解析时间格式: {v}")
        return v


class PermissionRecord(BaseModel):
    card_id: str
    person_name: str
    person_id: str
    department: str
    group: str
    allowed_zones: List[str]
    valid_from: Optional[datetime] = None
    valid_until: Optional[datetime] = None
    is_active: bool = True
    
    @validator("valid_from", "valid_until", pre=True)
    def parse_optional_datetime(cls, v):
        if v is None or v == "":
            return None
        if isinstance(v, datetime):
            return v
        for fmt in ["%Y-%m-%d", "%Y-%m-%d %H:%M:%S"]:
            try:
                return datetime.strptime(str(v), fmt)
            except ValueError:
                continue
        return None


class ZoneDefinition(BaseModel):
    zone_id: str
    name: str
    description: str = ""
    anti_passback_enabled: bool = True
    re_entry_grace_minutes: int = 5


class DataValidationError(BaseModel):
    file_name: str
    line_number: Optional[int] = None
    error_type: str
    message: str
    raw_data: Optional[str] = None


class ValidationResult(BaseModel):
    file_path: str
    total_records: int = 0
    valid_records: int = 0
    errors: List[DataValidationError] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)


class DataParser:
    @staticmethod
    def parse_device_log(json_path: Path) -> tuple[List[CardSwipeEvent], ValidationResult]:
        result = ValidationResult(file_path=str(json_path))
        
        with open(json_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        events = []
        device_id = data.get("device_id", "unknown")
        
        if "events" in data:
            raw_events = data["events"]
        elif isinstance(data, list):
            raw_events = data
        else:
            raw_events = [data]
        
        for idx, event_data in enumerate(raw_events):
            result.total_records += 1
            try:
                event = DataParser._parse_single_event(event_data, device_id, json_path.name)
                events.append(event)
                result.valid_records += 1
            except Exception as e:
                result.errors.append(DataValidationError(
                    file_name=json_path.name,
                    line_number=idx + 1,
                    error_type="parse_error",
                    message=str(e),
                    raw_data=json.dumps(event_data, ensure_ascii=False)
                ))
        
        return events, result

    @staticmethod
    def _parse_single_event(event_data: Dict[str, Any], device_id: str, source_file: str) -> CardSwipeEvent:
        raw_timestamp = event_data.get("timestamp", event_data.get("time", event_data.get("datetime", "")))
        
        direction = Direction.UNKNOWN
        direction_str = event_data.get("direction", event_data.get("dir", ""))
        if direction_str:
            direction_str_lower = str(direction_str).lower()
            if direction_str_lower in ["in", "enter", "进", "进入"]:
                direction = Direction.IN
            elif direction_str_lower in ["out", "exit", "出", "离开"]:
                direction = Direction.OUT
        
        event_type = EventType.SWIPE
        event_str = event_data.get("event_type", event_data.get("type", ""))
        if event_str:
            event_str_lower = str(event_str).lower()
            if event_str_lower in ["deny", "denied", "拒绝"]:
                event_type = EventType.DENY
            elif event_str_lower in ["alarm", "警告", "报警"]:
                event_type = EventType.ALARM
        
        return CardSwipeEvent(
            device_id=event_data.get("device_id", device_id),
            card_id=str(event_data.get("card_id", event_data.get("card", ""))).strip(),
            timestamp=raw_timestamp,
            zone_id=str(event_data.get("zone_id", event_data.get("zone", event_data.get("door", "")))).strip(),
            direction=direction,
            event_type=event_type,
            raw_timestamp=str(raw_timestamp),
            source_file=source_file
        )

    @staticmethod
    def parse_permissions_csv(csv_path: Path) -> tuple[List[PermissionRecord], ValidationResult]:
        result = ValidationResult(file_path=str(csv_path))
        records = []
        
        with open(csv_path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for idx, row in enumerate(reader):
                result.total_records += 1
                try:
                    record = DataParser._parse_permission_row(row)
                    records.append(record)
                    result.valid_records += 1
                except Exception as e:
                    result.errors.append(DataValidationError(
                        file_name=csv_path.name,
                        line_number=idx + 2,
                        error_type="parse_error",
                        message=str(e),
                        raw_data=json.dumps(row, ensure_ascii=False)
                    ))
        
        return records, result

    @staticmethod
    def _parse_permission_row(row: Dict[str, str]) -> PermissionRecord:
        allowed_zones_str = row.get("allowed_zones", row.get("zones", row.get("doors", "")))
        allowed_zones = [z.strip() for z in allowed_zones_str.split(",") if z.strip()]
        
        is_active = True
        active_str = row.get("is_active", row.get("active", "true")).lower()
        if active_str in ["false", "0", "no", "停用", "撤销", "撤权"]:
            is_active = False
        
        return PermissionRecord(
            card_id=str(row.get("card_id", row.get("card", ""))).strip(),
            person_name=str(row.get("person_name", row.get("name", ""))).strip(),
            person_id=str(row.get("person_id", row.get("employee_id", row.get("id", "")))).strip(),
            department=str(row.get("department", row.get("dept", ""))).strip(),
            group=str(row.get("group", row.get("role", row.get("级别", "普通")))).strip(),
            allowed_zones=allowed_zones,
            valid_from=row.get("valid_from", row.get("start_date", None)),
            valid_until=row.get("valid_until", row.get("end_date", row.get("expiry_date", None))),
            is_active=is_active
        )

    @staticmethod
    def parse_zones_csv(csv_path: Path) -> tuple[List[ZoneDefinition], ValidationResult]:
        result = ValidationResult(file_path=str(csv_path))
        zones = []
        
        with open(csv_path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for idx, row in enumerate(reader):
                result.total_records += 1
                try:
                    anti_passback = True
                    ap_str = row.get("anti_passback", row.get("apb", "true")).lower()
                    if ap_str in ["false", "0", "no", "禁用"]:
                        anti_passback = False
                    
                    grace_minutes = 5
                    grace_str = row.get("re_entry_grace_minutes", row.get("grace", "5"))
                    try:
                        grace_minutes = int(grace_str)
                    except ValueError:
                        pass
                    
                    zone = ZoneDefinition(
                        zone_id=str(row.get("zone_id", row.get("zone", row.get("door_id", "")))).strip(),
                        name=str(row.get("name", row.get("zone_name", ""))).strip(),
                        description=str(row.get("description", row.get("desc", ""))).strip(),
                        anti_passback_enabled=anti_passback,
                        re_entry_grace_minutes=grace_minutes
                    )
                    zones.append(zone)
                    result.valid_records += 1
                except Exception as e:
                    result.errors.append(DataValidationError(
                        file_name=csv_path.name,
                        line_number=idx + 2,
                        error_type="parse_error",
                        message=str(e),
                        raw_data=json.dumps(row, ensure_ascii=False)
                    ))
        
        return zones, result

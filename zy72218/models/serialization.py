import json
from datetime import datetime, date
from dataclasses import asdict, fields
from typing import Any, Dict, List, Optional

from models.entities import (
    Invoice,
    FundMatchRecord,
    HolidayExtension,
    TailAdjustment,
    DiscrepancyItem,
    AuditLog,
    ConflictEvidence,
    ConflictResolution,
    SelfCheckResult,
    MatchStatus,
    RecordType,
    DiscrepancyStatus,
    SelfCheckType,
)


_ENUM_MAP = {
    "MatchStatus": MatchStatus,
    "RecordType": RecordType,
    "DiscrepancyStatus": DiscrepancyStatus,
    "SelfCheckType": SelfCheckType,
}

_ENTITY_CLASS_MAP = {
    "Invoice": Invoice,
    "FundMatchRecord": FundMatchRecord,
    "HolidayExtension": HolidayExtension,
    "TailAdjustment": TailAdjustment,
    "DiscrepancyItem": DiscrepancyItem,
    "AuditLog": AuditLog,
    "ConflictEvidence": ConflictEvidence,
    "ConflictResolution": ConflictResolution,
    "SelfCheckResult": SelfCheckResult,
}

_ENUM_FIELDS = {
    "FundMatchRecord": {"record_type": RecordType, "status": MatchStatus},
    "DiscrepancyItem": {"status": DiscrepancyStatus},
    "ConflictResolution": {"resolution": DiscrepancyStatus},
    "SelfCheckResult": {"check_type": SelfCheckType},
}

_DATE_FIELDS = {
    "Invoice": ["invoice_date"],
    "FundMatchRecord": ["match_date"],
    "HolidayExtension": ["original_due_date", "extended_due_date"],
    "TailAdjustment": ["adjustment_date"],
}

_DATETIME_FIELDS = {
    "Invoice": ["imported_at"],
    "FundMatchRecord": ["created_at", "updated_at"],
    "HolidayExtension": ["imported_at"],
    "TailAdjustment": ["imported_at"],
    "DiscrepancyItem": ["created_at", "resolved_at"],
    "AuditLog": ["timestamp"],
    "SelfCheckResult": ["checked_at"],
    "ConflictResolution": ["resolved_at"],
}


def _parse_date(val: Any) -> Optional[date]:
    if val is None:
        return None
    if isinstance(val, date) and not isinstance(val, datetime):
        return val
    if isinstance(val, str):
        return date.fromisoformat(val)
    return None


def _parse_datetime(val: Any) -> Optional[datetime]:
    if val is None:
        return None
    if isinstance(val, datetime):
        return val
    if isinstance(val, str):
        return datetime.fromisoformat(val)
    return None


def entity_to_dict(entity: Any) -> Dict[str, Any]:
    d = asdict(entity)
    return _convert_values(d)


def _convert_values(d: Dict[str, Any]) -> Dict[str, Any]:
    out = {}
    for k, v in d.items():
        if isinstance(v, (date, datetime)):
            out[k] = v.isoformat()
        elif hasattr(v, "value"):
            out[k] = v.value
        elif isinstance(v, list):
            out[k] = [
                _convert_values(item) if isinstance(item, dict) else
                item.value if hasattr(item, "value") else
                item.isoformat() if isinstance(item, (date, datetime)) else
                item
                for item in v
            ]
        elif isinstance(v, dict):
            out[k] = _convert_values(v)
        else:
            out[k] = v
    return out


def dict_to_entity(class_name: str, d: Dict[str, Any]) -> Any:
    cls = _ENTITY_CLASS_MAP.get(class_name)
    if cls is None:
        raise ValueError(f"Unknown entity class: {class_name}")

    enum_fields = _ENUM_FIELDS.get(class_name, {})
    date_fields = _DATE_FIELDS.get(class_name, [])
    datetime_fields = _DATETIME_FIELDS.get(class_name, [])

    converted = dict(d)
    for field_name, enum_cls in enum_fields.items():
        val = converted.get(field_name)
        if val is not None and not isinstance(val, enum_cls):
            try:
                converted[field_name] = enum_cls(val)
            except (ValueError, KeyError):
                pass

    for field_name in date_fields:
        converted[field_name] = _parse_date(converted.get(field_name))

    for field_name in datetime_fields:
        converted[field_name] = _parse_datetime(converted.get(field_name))

    valid_fields = {f.name for f in fields(cls)}
    converted = {k: v for k, v in converted.items() if k in valid_fields}

    return cls(**converted)


def save_to_json(data: Any, filepath: str) -> None:
    if isinstance(data, list):
        serialized = [entity_to_dict(item) if hasattr(item, "__dataclass_fields__") else item for item in data]
    elif hasattr(data, "__dataclass_fields__"):
        serialized = entity_to_dict(data)
    else:
        serialized = data
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(serialized, f, ensure_ascii=False, indent=2, default=str)


def load_from_json(filepath: str, class_name: str) -> List[Any]:
    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)
    if isinstance(data, list):
        return [dict_to_entity(class_name, item) for item in data]
    return [dict_to_entity(class_name, data)]

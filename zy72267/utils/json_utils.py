from datetime import datetime
from dataclasses import asdict, is_dataclass
from enum import Enum
from typing import Any


def json_serializer(obj: Any) -> Any:
    if isinstance(obj, datetime):
        return obj.isoformat()
    if isinstance(obj, Enum):
        return obj.value
    if is_dataclass(obj) and not isinstance(obj, type):
        return make_json_serializable(asdict(obj))
    if isinstance(obj, dict):
        return {k: make_json_serializable(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [make_json_serializable(item) for item in obj]
    return obj


def make_json_serializable(data: Any) -> Any:
    if isinstance(data, dict):
        return {k: make_json_serializable(v) for k, v in data.items()}
    elif isinstance(data, (list, tuple)):
        return [make_json_serializable(item) for item in data]
    elif isinstance(data, datetime):
        return data.isoformat()
    elif isinstance(data, Enum):
        return data.value
    elif is_dataclass(data) and not isinstance(data, type):
        return make_json_serializable(asdict(data))
    else:
        return data

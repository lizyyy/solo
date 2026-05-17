import hashlib
import json
from typing import Any, Dict


def stable_hash(data: Dict[str, Any]) -> str:
    sorted_data = _sort_dict(data)
    json_str = json.dumps(sorted_data, ensure_ascii=False, sort_keys=True)
    return hashlib.sha256(json_str.encode("utf-8")).hexdigest()[:16]


def _sort_dict(data: Dict[str, Any]) -> Dict[str, Any]:
    result: Dict[str, Any] = {}
    for key in sorted(data.keys()):
        value = data[key]
        if isinstance(value, dict):
            result[key] = _sort_dict(value)
        elif isinstance(value, list):
            result[key] = _sort_list(value)
        else:
            result[key] = value
    return result


def _sort_list(data: list) -> list:
    result = []
    for item in data:
        if isinstance(item, dict):
            result.append(_sort_dict(item))
        elif isinstance(item, list):
            result.append(_sort_list(item))
        else:
            result.append(item)
    try:
        return sorted(result)
    except TypeError:
        return result

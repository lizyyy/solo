import re
from typing import Any, Dict, List, Optional, Tuple

SENSITIVE_KEYS = frozenset({
    "student_name", "teacher_name", "name", "phone", "email",
    "address", "birth_date", "parent_name", "parent_phone",
})

_MASK_CACHE: Dict[str, str] = {}
_mask_counter = 0


def _short_hash(s: str) -> str:
    return format(abs(hash(s)) % (10 ** 6), "06d")


def mask_value(key: str, value: Any) -> Any:
    if key not in SENSITIVE_KEYS:
        return value
    if value is None:
        return None
    s = str(value)
    if not s:
        return s
    if s in _MASK_CACHE:
        return _MASK_CACHE[s]
    if len(s) <= 1:
        result = "*"
    elif len(s) == 2:
        result = s[0] + "*"
    else:
        result = s[0] + "*" * (len(s) - 2) + s[-1]
    _MASK_CACHE[s] = result
    return result


def mask_dict(data: Dict[str, Any], extra_keys: Optional[List[str]] = None) -> Dict[str, Any]:
    keys_to_mask = SENSITIVE_KEYS
    if extra_keys:
        keys_to_mask = keys_to_mask | frozenset(extra_keys)
    result = {}
    for k, v in data.items():
        if isinstance(v, dict):
            result[k] = mask_dict(v, extra_keys)
        elif isinstance(v, list):
            result[k] = [
                mask_dict(item, extra_keys) if isinstance(item, dict) else
                mask_value(k, item) if k in keys_to_mask else item
                for item in v
            ]
        elif k in keys_to_mask:
            result[k] = mask_value(k, v)
        else:
            result[k] = v
    return result

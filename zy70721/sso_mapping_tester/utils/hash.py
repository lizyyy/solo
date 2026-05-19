import hashlib
import json
from typing import Any, List, Dict


def stable_hash(obj: Any) -> str:
    if isinstance(obj, dict):
        sorted_dict = {k: stable_hash(v) for k, v in sorted(obj.items())}
        obj = sorted_dict
    elif isinstance(obj, list):
        obj = [stable_hash(item) for item in obj]
    elif isinstance(obj, set):
        obj = sorted([stable_hash(item) for item in obj])
    
    json_str = json.dumps(obj, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(json_str.encode("utf-8")).hexdigest()[:16]


def stable_sort(lst: List[Any], key=None) -> List[Any]:
    if key is None:
        return sorted(lst, key=lambda x: stable_hash(x))
    return sorted(lst, key=lambda x: stable_hash(key(x)))


def stable_dict(d: Dict[str, Any]) -> Dict[str, Any]:
    result = {}
    for k in sorted(d.keys()):
        v = d[k]
        if isinstance(v, dict):
            result[k] = stable_dict(v)
        elif isinstance(v, list):
            result[k] = stable_sort(v)
        else:
            result[k] = v
    return result

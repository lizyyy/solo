import math
import json
from typing import Any


def clean_for_json(obj: Any) -> Any:
    if isinstance(obj, dict):
        return {k: clean_for_json(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [clean_for_json(item) for item in obj]
    elif isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return None
        return obj
    elif hasattr(obj, 'isoformat'):
        return obj.isoformat()
    return obj


def safe_json_dumps(obj: Any, **kwargs) -> str:
    return json.dumps(clean_for_json(obj), **kwargs)

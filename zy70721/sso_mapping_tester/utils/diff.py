from typing import Any, Dict, List, Tuple
from .hash import stable_hash


def dict_diff(old: Dict[str, Any], new: Dict[str, Any]) -> Dict[str, Tuple[str, Any, Any]]:
    diffs = {}
    all_keys = set(old.keys()) | set(new.keys())
    
    for key in sorted(all_keys):
        old_val = old.get(key)
        new_val = new.get(key)
        
        if key not in old:
            diffs[key] = ("added", None, new_val)
        elif key not in new:
            diffs[key] = ("removed", old_val, None)
        elif stable_hash(old_val) != stable_hash(new_val):
            if isinstance(old_val, dict) and isinstance(new_val, dict):
                nested = dict_diff(old_val, new_val)
                for nested_key, (op, ov, nv) in nested.items():
                    diffs[f"{key}.{nested_key}"] = (op, ov, nv)
            elif isinstance(old_val, list) and isinstance(new_val, list):
                list_diffs = list_diff(old_val, new_val)
                if list_diffs:
                    diffs[key] = ("list_changed", old_val, new_val)
            else:
                diffs[key] = ("modified", old_val, new_val)
    
    return diffs


def list_diff(old: List[Any], new: List[Any]) -> List[Tuple[str, int, Any]]:
    diffs = []
    old_set = set(stable_hash(item) for item in old)
    new_set = set(stable_hash(item) for item in new)
    
    old_map = {stable_hash(item): item for item in old}
    new_map = {stable_hash(item): item for item in new}
    
    for h in old_set - new_set:
        idx = next(i for i, item in enumerate(old) if stable_hash(item) == h)
        diffs.append(("removed", idx, old_map[h]))
    
    for h in new_set - old_set:
        idx = next(i for i, item in enumerate(new) if stable_hash(item) == h)
        diffs.append(("added", idx, new_map[h]))
    
    return diffs

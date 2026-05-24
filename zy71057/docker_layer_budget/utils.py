import hashlib
import json
import os
from pathlib import Path
from typing import Any


def format_size(size_bytes: int) -> str:
    if size_bytes < 0:
        return f"-{format_size(-size_bytes)}"
    if size_bytes == 0:
        return "0 B"
    units = ["B", "KB", "MB", "GB", "TB"]
    i = 0
    while size_bytes >= 1024 and i < len(units) - 1:
        size_bytes /= 1024
        i += 1
    return f"{size_bytes:.2f} {units[i]}"


def parse_size(size_str: str) -> int:
    size_str = size_str.strip().upper()
    units = {
        "B": 1,
        "KB": 1024,
        "MB": 1024 * 1024,
        "GB": 1024 * 1024 * 1024,
        "TB": 1024 * 1024 * 1024 * 1024,
    }
    for unit, multiplier in units.items():
        if size_str.endswith(unit):
            return int(float(size_str[: -len(unit)]) * multiplier)
    return int(float(size_str))


def ensure_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)


def stable_hash(data: Any) -> str:
    if isinstance(data, dict):
        data = json.dumps(data, sort_keys=True, ensure_ascii=False)
    elif not isinstance(data, str):
        data = str(data)
    return hashlib.sha256(data.encode("utf-8")).hexdigest()[:16]


def find_files_by_patterns(directory: str, patterns: list) -> list:
    results = []
    base_path = Path(directory)
    for pattern in patterns:
        results.extend(base_path.rglob(pattern))
    return results


def is_in_cached_dir(file_path: str, cached_dirs: list) -> bool:
    for cached_dir in cached_dirs:
        if file_path.startswith(cached_dir):
            return True
    return False

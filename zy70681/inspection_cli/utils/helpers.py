import hashlib
import json
from pathlib import Path
from typing import Any, Dict, Optional
from datetime import datetime
import re


def stable_hash(data: Any) -> str:
    if isinstance(data, dict):
        data = json.dumps(data, sort_keys=True, ensure_ascii=False)
    elif not isinstance(data, str):
        data = str(data)
    return hashlib.sha256(data.encode("utf-8")).hexdigest()[:16]


def get_file_location(
    file_path: str,
    sheet_name: Optional[str] = None,
    row_number: Optional[int] = None,
    column_name: Optional[str] = None
) -> str:
    parts = [file_path]
    if sheet_name:
        parts.append(f"[{sheet_name}]")
    if row_number is not None:
        parts.append(f"第{row_number}行")
    if column_name:
        parts.append(f"({column_name})")
    return "".join(parts)


def normalize_string(s: Optional[str]) -> str:
    if s is None:
        return ""
    s = str(s).strip()
    s = re.sub(r'\s+', ' ', s)
    return s


def parse_date(value: Any) -> Optional[datetime]:
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return value
    from dateutil import parser
    try:
        return parser.parse(str(value))
    except (ValueError, TypeError):
        return None


def safe_float(value: Any, default: float = 0.0) -> float:
    if value is None or value == "":
        return default
    try:
        return float(value)
    except (ValueError, TypeError):
        return default


def safe_int(value: Any, default: int = 0) -> int:
    if value is None or value == "":
        return default
    try:
        return int(value)
    except (ValueError, TypeError):
        return default


def is_valid_file_path(path: str) -> bool:
    try:
        return Path(path).exists()
    except Exception:
        return False


def generate_id(*args: Any) -> str:
    combined = "_".join(str(arg) for arg in args if arg is not None)
    return stable_hash(combined)

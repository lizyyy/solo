import json
import os
from datetime import datetime, date
from typing import Dict, List, Any, Optional

STORAGE_DIR = os.path.join(os.path.dirname(__file__), "data")

FILES = {
    "dept_limits": "department_limits.json",
    "inventory": "inventory.json",
    "requests": "requests.json",
    "emergency_borrows": "emergency_borrows.json"
}

def ensure_storage_dir():
    if not os.path.exists(STORAGE_DIR):
        os.makedirs(STORAGE_DIR)

def _get_file_path(file_key: str) -> str:
    return os.path.join(STORAGE_DIR, FILES[file_key])

def _read_json(file_key: str) -> Any:
    ensure_storage_dir()
    path = _get_file_path(file_key)
    if not os.path.exists(path):
        return [] if file_key in ["inventory", "requests", "emergency_borrows"] else {}
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def _write_json(file_key: str, data: Any) -> None:
    ensure_storage_dir()
    path = _get_file_path(file_key)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def load_dept_limits() -> Dict[str, Dict[str, Any]]:
    return _read_json("dept_limits")

def save_dept_limits(data: Dict[str, Dict[str, Any]]) -> None:
    _write_json("dept_limits", data)

def load_inventory() -> List[Dict[str, Any]]:
    return _read_json("inventory")

def save_inventory(data: List[Dict[str, Any]]) -> None:
    _write_json("inventory", data)

def load_requests() -> List[Dict[str, Any]]:
    return _read_json("requests")

def save_requests(data: List[Dict[str, Any]]) -> None:
    _write_json("requests", data)

def load_emergency_borrows() -> List[Dict[str, Any]]:
    return _read_json("emergency_borrows")

def save_emergency_borrows(data: List[Dict[str, Any]]) -> None:
    _write_json("emergency_borrows", data)

def today_str() -> str:
    return date.today().isoformat()

def parse_date(date_str: str) -> date:
    return datetime.strptime(date_str, "%Y-%m-%d").date()

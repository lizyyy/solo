import json
import os
from datetime import datetime
from typing import List, Dict, Optional
import uuid

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
RECORDS_FILE = os.path.join(DATA_DIR, "revenue_records.json")
BATCHES_FILE = os.path.join(DATA_DIR, "batches.json")


def _ensure_data_dir():
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR, exist_ok=True)


def _load_json(file_path: str, default: any) -> any:
    _ensure_data_dir()
    if not os.path.exists(file_path):
        return default
    with open(file_path, "r", encoding="utf-8") as f:
        return json.load(f)


def _save_json(file_path: str, data: any) -> None:
    _ensure_data_dir()
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def load_records() -> List[Dict]:
    return _load_json(RECORDS_FILE, [])


def save_records(records: List[Dict]) -> None:
    _save_json(RECORDS_FILE, records)


def load_batches() -> List[Dict]:
    return _load_json(BATCHES_FILE, [])


def save_batches(batches: List[Dict]) -> None:
    _save_json(BATCHES_FILE, batches)


def generate_id(prefix: str = "") -> str:
    return f"{prefix}{uuid.uuid4().hex[:8].upper()}"


def now_str() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")

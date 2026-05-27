import json
import os
from datetime import datetime
from typing import Dict, Any, Optional

STORAGE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
BATCH_FILE = os.path.join(STORAGE_DIR, "batches.json")
RESULT_FILE = os.path.join(STORAGE_DIR, "results.json")

os.makedirs(STORAGE_DIR, exist_ok=True)


def _read_json(filepath: str) -> Dict[str, Any]:
    if not os.path.exists(filepath):
        return {}
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError):
        return {}


def _write_json(filepath: str, data: Dict[str, Any]) -> None:
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2, default=str)


def is_batch_processed(batch_id: str) -> bool:
    batches = _read_json(BATCH_FILE)
    return batch_id in batches


def save_batch(batch_id: str, metadata: Dict[str, Any]) -> None:
    batches = _read_json(BATCH_FILE)
    batches[batch_id] = {
        **metadata,
        "submitted_at": datetime.now().isoformat()
    }
    _write_json(BATCH_FILE, batches)


def save_result(batch_id: str, result: Dict[str, Any]) -> None:
    results = _read_json(RESULT_FILE)
    results[batch_id] = result
    _write_json(RESULT_FILE, results)


def get_result(batch_id: str) -> Optional[Dict[str, Any]]:
    results = _read_json(RESULT_FILE)
    return results.get(batch_id)

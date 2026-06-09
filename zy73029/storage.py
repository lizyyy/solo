import json
import os
import threading
from typing import List, Optional, Dict, Any
from models import TempControlRecord, _now_iso, _new_id

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
DATA_FILE = os.path.join(DATA_DIR, "records.json")

_lock = threading.RLock()


def _ensure_dir():
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR, exist_ok=True)


def _load_raw() -> Dict[str, Any]:
    _ensure_dir()
    if not os.path.exists(DATA_FILE):
        return {"records": [], "meta": {"version": 1, "created_at": _now_iso()}}
    try:
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError):
        return {"records": [], "meta": {"version": 1, "created_at": _now_iso()}}


def _save_raw(data: Dict[str, Any]):
    _ensure_dir()
    tmp = DATA_FILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    os.replace(tmp, DATA_FILE)


def list_records() -> List[TempControlRecord]:
    with _lock:
        raw = _load_raw()
        return [TempControlRecord.from_dict(r) for r in raw.get("records", [])]


def get_record(record_id: str) -> Optional[TempControlRecord]:
    with _lock:
        raw = _load_raw()
        for r in raw.get("records", []):
            if r["record_id"] == record_id:
                return TempControlRecord.from_dict(r)
        return None


def save_record(record: TempControlRecord) -> TempControlRecord:
    with _lock:
        raw = _load_raw()
        records = raw.get("records", [])
        found = False
        for i, r in enumerate(records):
            if r["record_id"] == record.record_id:
                records[i] = record.to_dict()
                found = True
                break
        if not found:
            records.insert(0, record.to_dict())
        raw["records"] = records
        raw["meta"]["updated_at"] = _now_iso()
        _save_raw(raw)
        return record


def create_record(pet_name: str, pet_type: str, owner_name: str,
                  original_temp: float, target_temp_min: float,
                  target_temp_max: float, current_temp: float,
                  owner_contact: str = "") -> TempControlRecord:
    rec = TempControlRecord(
        pet_name=pet_name,
        pet_type=pet_type,
        owner_name=owner_name,
        owner_contact=owner_contact,
        original_temp=original_temp,
        target_temp_min=target_temp_min,
        target_temp_max=target_temp_max,
        current_temp=current_temp,
    )
    rec.append_timeline("create", f"创建温控回访记录：{pet_name}({pet_type})，初温 {original_temp}℃")
    save_record(rec)
    return rec


def update_record(record: TempControlRecord) -> TempControlRecord:
    return save_record(record)


def delete_record(record_id: str) -> bool:
    with _lock:
        raw = _load_raw()
        records = [r for r in raw.get("records", []) if r["record_id"] != record_id]
        if len(records) == len(raw.get("records", [])):
            return False
        raw["records"] = records
        _save_raw(raw)
        return True


def get_stats() -> Dict[str, Any]:
    records = list_records()
    total = len(records)
    by_status = {}
    has_flag = 0
    has_blocker = 0
    has_override = 0
    for r in records:
        s = r.status
        by_status[s] = by_status.get(s, 0) + 1
        if r.flags:
            has_flag += 1
        if any(f.level == "blocker" and not f.resolved for f in r.flags):
            has_blocker += 1
        if r.overrides:
            has_override += 1
    return {
        "total": total,
        "by_status": by_status,
        "has_flag": has_flag,
        "has_blocker": has_blocker,
        "has_override": has_override,
    }

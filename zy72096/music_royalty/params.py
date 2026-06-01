import json
import os
from typing import Any, Dict, Optional
from datetime import datetime


PARAMS_FILENAME = "params_persist.json"


class ParamStore:
    def __init__(self, work_dir: str = "."):
        self.work_dir = work_dir
        self.path = os.path.join(work_dir, PARAMS_FILENAME)
        self._data: Dict[str, Dict[str, Any]] = {}
        self._load()

    def _load(self):
        if os.path.exists(self.path):
            with open(self.path, "r", encoding="utf-8") as f:
                raw = json.load(f)
            for rid, fields in raw.items():
                if not isinstance(fields, dict):
                    continue
                self._data[rid] = {}
                for field_name, info in fields.items():
                    if isinstance(info, dict) and "manually_adjusted" in info:
                        self._data[rid][field_name] = info
                    else:
                        self._data[rid][field_name] = {
                            "value": info,
                            "manually_adjusted": False,
                            "updated_at": datetime.now().isoformat(),
                        }

    def _save(self):
        with open(self.path, "w", encoding="utf-8") as f:
            json.dump(self._data, f, ensure_ascii=False, indent=2)

    def get(self, record_id: str, field: str) -> Optional[Any]:
        fields = self._data.get(record_id)
        if not fields:
            return None
        info = fields.get(field)
        if info is None:
            return None
        if isinstance(info, dict):
            return info.get("value")
        return info

    def set(
        self,
        record_id: str,
        field: str,
        value: Any,
        manually_adjusted: bool = False,
    ):
        if record_id not in self._data:
            self._data[record_id] = {}

        existing = self._data[record_id].get(field)
        if isinstance(existing, dict) and existing.get("manually_adjusted") and not manually_adjusted:
            return

        self._data[record_id][field] = {
            "value": value,
            "manually_adjusted": manually_adjusted,
            "updated_at": datetime.now().isoformat(),
        }
        self._save()

    def mark_exception(self, record_id: str, note: str = ""):
        if record_id not in self._data:
            self._data[record_id] = {}
        self._data[record_id]["__exception__"] = {
            "value": True,
            "note": note,
            "manually_adjusted": True,
            "updated_at": datetime.now().isoformat(),
        }
        self._save()

    def is_exception(self, record_id: str) -> bool:
        fields = self._data.get(record_id, {})
        exc = fields.get("__exception__")
        if exc and isinstance(exc, dict):
            return exc.get("value", False)
        return False

    def get_exception_note(self, record_id: str) -> str:
        fields = self._data.get(record_id, {})
        exc = fields.get("__exception__")
        if exc and isinstance(exc, dict):
            return exc.get("note", "")
        return ""

    def list_records(self) -> list:
        return list(self._data.keys())

    def get_all(self, record_id: str) -> Dict[str, Any]:
        return dict(self._data.get(record_id, {}))

    def remove(self, record_id: str, field: str):
        if record_id in self._data and field in self._data[record_id]:
            del self._data[record_id][field]
            self._save()

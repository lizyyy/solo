import os
import json
from typing import List, Dict, Optional
from .models import FittingRecord, generate_data_hash, generate_record_id


class HistoryManager:
    def __init__(self, history_dir: str = "./history"):
        self.history_dir = history_dir
        self.index_file = os.path.join(history_dir, "index.json")
        self._ensure_dirs()
        self._load_index()

    def _ensure_dirs(self):
        os.makedirs(self.history_dir, exist_ok=True)

    def _load_index(self):
        if os.path.exists(self.index_file):
            with open(self.index_file, "r", encoding="utf-8") as f:
                self.index = json.load(f)
        else:
            self.index = {
                "by_batch": {},
                "by_material": {},
                "by_hash": {},
                "all_records": []
            }

    def _save_index(self):
        with open(self.index_file, "w", encoding="utf-8") as f:
            json.dump(self.index, f, indent=2, ensure_ascii=False)

    def save_record(self, record: FittingRecord) -> str:
        existing = self.find_by_hash(record.input_data_hash)
        if existing:
            record.version = existing.version + 1
            record.parent_id = existing.record_id

        record_file = os.path.join(self.history_dir, f"{record.record_id}.json")
        with open(record_file, "w", encoding="utf-8") as f:
            json.dump(record.to_dict(), f, indent=2, ensure_ascii=False)

        self._update_index(record)
        self._save_index()
        return record.record_id

    def _update_index(self, record: FittingRecord):
        if record.batch_id not in self.index["by_batch"]:
            self.index["by_batch"][record.batch_id] = []
        if record.record_id not in self.index["by_batch"][record.batch_id]:
            self.index["by_batch"][record.batch_id].append(record.record_id)

        if record.material_id not in self.index["by_material"]:
            self.index["by_material"][record.material_id] = []
        if record.record_id not in self.index["by_material"][record.material_id]:
            self.index["by_material"][record.material_id].append(record.record_id)

        self.index["by_hash"][record.input_data_hash] = record.record_id

        record_info = {
            "record_id": record.record_id,
            "batch_id": record.batch_id,
            "material_id": record.material_id,
            "timestamp": record.timestamp,
            "status": record.status,
            "version": record.version,
            "violation_count": len(record.constraint_violations)
        }
        self.index["all_records"].insert(0, record_info)

    def load_record(self, record_id: str) -> Optional[FittingRecord]:
        record_file = os.path.join(self.history_dir, f"{record_id}.json")
        if os.path.exists(record_file):
            with open(record_file, "r", encoding="utf-8") as f:
                return FittingRecord.from_dict(json.load(f))
        return None

    def find_by_hash(self, data_hash: str) -> Optional[FittingRecord]:
        if data_hash in self.index["by_hash"]:
            return self.load_record(self.index["by_hash"][data_hash])
        return None

    def find_by_batch(self, batch_id: str) -> List[FittingRecord]:
        record_ids = self.index["by_batch"].get(batch_id, [])
        return [r for r in [self.load_record(rid) for rid in record_ids] if r]

    def find_by_material(self, material_id: str) -> List[FittingRecord]:
        record_ids = self.index["by_material"].get(material_id, [])
        return [r for r in [self.load_record(rid) for rid in record_ids] if r]

    def get_all_records_summary(self) -> List[Dict]:
        return self.index["all_records"]

    def get_version_history(self, record_id: str) -> List[FittingRecord]:
        history = []
        current = self.load_record(record_id)
        while current:
            history.append(current)
            if current.parent_id:
                current = self.load_record(current.parent_id)
            else:
                break
        return history

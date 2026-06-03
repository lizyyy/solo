"""数据存储管理"""

import json
import os
from pathlib import Path
from typing import List, Optional

from .models import ImportRecord, calculate_file_hash, generate_import_id


class StorageManager:
    def __init__(self, data_dir: str = "./data"):
        self.data_dir = Path(data_dir)
        self.records_dir = self.data_dir / "records"
        self.exports_dir = self.data_dir / "exports"
        self._ensure_dirs()

    def _ensure_dirs(self):
        self.records_dir.mkdir(parents=True, exist_ok=True)
        self.exports_dir.mkdir(parents=True, exist_ok=True)

    def save_record(self, record: ImportRecord) -> str:
        file_path = self.records_dir / f"{record.import_id}.json"
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(record.to_dict(), f, ensure_ascii=False, indent=2)
        return str(file_path)

    def load_record(self, import_id: str) -> Optional[ImportRecord]:
        file_path = self.records_dir / f"{import_id}.json"
        if not file_path.exists():
            return None
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return ImportRecord.from_dict(data)

    def list_records(self) -> List[str]:
        return sorted([f.stem for f in self.records_dir.glob("IMP*.json")], reverse=True)

    def find_duplicate(self, file_hash: str) -> Optional[ImportRecord]:
        for import_id in self.list_records():
            record = self.load_record(import_id)
            if record and record.file_hash == file_hash:
                return record
        return None

    def get_latest_record(self) -> Optional[ImportRecord]:
        records = self.list_records()
        if not records:
            return None
        return self.load_record(records[0])

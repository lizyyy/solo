import json
import os
from pathlib import Path
from typing import List, Optional, Dict, Any
from datetime import datetime
from .models import QualityRecord, Status, AbnormalType, RecordType


class Storage:
    def __init__(self, data_dir: Optional[str] = None):
        if data_dir is None:
            data_dir = os.path.join(Path.home(), ".qc_data")
        self.data_dir = Path(data_dir)
        self.data_file = self.data_dir / "records.json"
        self._ensure_data_dir()

    def _ensure_data_dir(self):
        self.data_dir.mkdir(parents=True, exist_ok=True)
        if not self.data_file.exists():
            self._save_data({"records": [], "next_id": 1})

    def _load_data(self) -> Dict[str, Any]:
        with open(self.data_file, "r", encoding="utf-8") as f:
            return json.load(f)

    def _save_data(self, data: Dict[str, Any]):
        with open(self.data_file, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def generate_id(self) -> str:
        data = self._load_data()
        next_id = data["next_id"]
        data["next_id"] = next_id + 1
        self._save_data(data)
        return f"REC{next_id:06d}"

    def add_record(self, record: QualityRecord) -> QualityRecord:
        data = self._load_data()
        data["records"].append(record.to_dict())
        self._save_data(data)
        return record

    def get_record(self, record_id: str) -> Optional[QualityRecord]:
        data = self._load_data()
        for r in data["records"]:
            if r["id"] == record_id:
                return QualityRecord.from_dict(r)
        return None

    def update_record(self, record: QualityRecord) -> Optional[QualityRecord]:
        data = self._load_data()
        for i, r in enumerate(data["records"]):
            if r["id"] == record.id:
                record.updated_at = datetime.now().isoformat()
                data["records"][i] = record.to_dict()
                self._save_data(data)
                return record
        return None

    def delete_record(self, record_id: str) -> bool:
        data = self._load_data()
        original_count = len(data["records"])
        data["records"] = [r for r in data["records"] if r["id"] != record_id]
        if len(data["records"]) != original_count:
            self._save_data(data)
            return True
        return False

    def list_records(
        self,
        responsible: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        status: Optional[Status] = None,
        abnormal_type: Optional[AbnormalType] = None,
        record_type: Optional[RecordType] = None,
    ) -> List[QualityRecord]:
        data = self._load_data()
        records = [QualityRecord.from_dict(r) for r in data["records"]]

        if responsible:
            records = [r for r in records if responsible in r.responsible]
        if start_date:
            records = [r for r in records if r.date >= start_date]
        if end_date:
            records = [r for r in records if r.date <= end_date]
        if status:
            records = [r for r in records if r.status == status]
        if abnormal_type:
            records = [r for r in records if r.abnormal_type == abnormal_type]
        if record_type:
            records = [r for r in records if r.record_type == record_type]

        return sorted(records, key=lambda r: (r.date, r.id), reverse=True)

    def get_all_records(self) -> List[QualityRecord]:
        return self.list_records()

    def clear_all(self) -> int:
        data = self._load_data()
        count = len(data["records"])
        data["records"] = []
        data["next_id"] = 1
        self._save_data(data)
        return count

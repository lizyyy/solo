import json
import os
from typing import List, Optional
from .models import VerificationRecord


DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
RECORDS_FILE = os.path.join(DATA_DIR, "records.json")


class RecordStore:
    def __init__(self, file_path: str = RECORDS_FILE):
        self.file_path = file_path
        self._ensure_dir()

    def _ensure_dir(self):
        os.makedirs(os.path.dirname(self.file_path), exist_ok=True)
        if not os.path.exists(self.file_path):
            with open(self.file_path, "w", encoding="utf-8") as f:
                json.dump([], f, ensure_ascii=False, indent=2)

    def load_all(self) -> List[VerificationRecord]:
        if not os.path.exists(self.file_path):
            return []
        with open(self.file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return [VerificationRecord.create(**item) for item in data]

    def save_all(self, records: List[VerificationRecord]):
        with open(self.file_path, "w", encoding="utf-8") as f:
            json.dump([r.to_dict() for r in records], f, ensure_ascii=False, indent=2)

    def find_by_id(self, record_id: str) -> Optional[VerificationRecord]:
        for r in self.load_all():
            if r.id == record_id:
                return r
        return None

    def update(self, record: VerificationRecord):
        records = self.load_all()
        found = False
        for i, r in enumerate(records):
            if r.id == record.id:
                records[i] = record
                found = True
                break
        if not found:
            records.append(record)
        self.save_all(records)

    def add_record(self, record: VerificationRecord):
        records = self.load_all()
        records.append(record)
        self.save_all(records)

    def append_attachment(self, record_id: str, kind: str, content: str):
        record = self.find_by_id(record_id)
        if record:
            record.add_attachment(kind, content)
            self.update(record)
            return True
        return False

    def confirm_record(self, record_id: str, operator: str, note: str, override_result: Optional[float] = None):
        record = self.find_by_id(record_id)
        if record:
            record.confirm(operator, note, override_result)
            self.update(record)
            return True
        return False

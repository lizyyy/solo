import json
import os
from pathlib import Path
from typing import List, Dict, Optional
from datetime import datetime

from .models import FinanceCarrierRecord, ProcessingLog, CandidateItem
from .constants import ProcessingStatus


class Storage:
    def __init__(self, base_path: str = "./data"):
        self.base_path = Path(base_path)
        self.records_path = self.base_path / "records.json"
        self.logs_path = self.base_path / "processing_logs.json"
        self._init_storage()

    def _init_storage(self):
        self.base_path.mkdir(parents=True, exist_ok=True)
        if not self.records_path.exists():
            self._write_json(self.records_path, [])
        if not self.logs_path.exists():
            self._write_json(self.logs_path, [])

    def _read_json(self, path: Path) -> List[Dict]:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)

    def _write_json(self, path: Path, data: List[Dict]):
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def save_record(self, record: FinanceCarrierRecord):
        records = self._read_json(self.records_path)
        records.append(record.to_dict())
        self._write_json(self.records_path, records)

    def get_all_records(self) -> List[Dict]:
        return self._read_json(self.records_path)

    def find_record_by_batch(self, batch_no: str) -> Optional[Dict]:
        records = self._read_json(self.records_path)
        for record in records:
            if record["batch_no"] == batch_no:
                return record
        return None

    def save_log(self, log: ProcessingLog):
        logs = self._read_json(self.logs_path)
        logs.append(log.to_dict())
        self._write_json(self.logs_path, logs)

    def update_log(self, log_id: str, updates: Dict):
        logs = self._read_json(self.logs_path)
        for log in logs:
            if log["log_id"] == log_id:
                log.update(updates)
                break
        self._write_json(self.logs_path, logs)

    def get_all_logs(self) -> List[Dict]:
        return self._read_json(self.logs_path)

    def query_logs(
        self,
        status: Optional[str] = None,
        processor: Optional[str] = None,
        batch_no: Optional[str] = None,
    ) -> List[Dict]:
        logs = self._read_json(self.logs_path)
        if status and status != "all":
            logs = [log for log in logs if log["status"] == status]
        if processor:
            logs = [log for log in logs if log.get("processor") == processor]
        if batch_no:
            logs = [log for log in logs if log.get("batch_no") == batch_no]
        return logs

    def delete_record_by_batch(self, batch_no: str) -> bool:
        records = self._read_json(self.records_path)
        original_len = len(records)
        records = [r for r in records if r["batch_no"] != batch_no]
        if len(records) < original_len:
            self._write_json(self.records_path, records)
            return True
        return False

    def get_rollback_candidates(self, date_cutoff: Optional[str] = None) -> List[CandidateItem]:
        records = self._read_json(self.records_path)
        candidates = []
        
        for record in records:
            if date_cutoff:
                record_date = record.get("carrier_date", "")
                if record_date and record_date > date_cutoff:
                    continue
            candidates.append(
                CandidateItem(
                    batch_no=record["batch_no"],
                    source_system=record["source_system"],
                    action="rollback",
                    reason="回滚候选",
                )
            )
        return candidates

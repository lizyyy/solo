from __future__ import annotations

import json
import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Dict, Any
import copy

from .models import PrintRecord, HistoryEntry, BatchValidationResult


class Storage:
    def __init__(self, base_dir: Path, config: Dict[str, Any]):
        self.base_dir = base_dir
        self.config = config
        self.data_dirs = config["data_dirs"]
        self._ensure_dirs()
        self._records_file = self.base_dir / self.data_dirs["history"] / "all_records.json"
        self._history_file = self.base_dir / self.data_dirs["history"] / "history_log.json"
        self._ensure_data_files()

    def _ensure_dirs(self) -> None:
        for dir_name in self.data_dirs.values():
            dir_path = self.base_dir / dir_name
            dir_path.mkdir(parents=True, exist_ok=True)

    def _ensure_data_files(self) -> None:
        if not self._records_file.exists():
            self._records_file.write_text(json.dumps([], indent=2, ensure_ascii=False))
        if not self._history_file.exists():
            self._history_file.write_text(json.dumps([], indent=2, ensure_ascii=False))

    def _read_json(self, file_path: Path) -> List[Dict[str, Any]]:
        if not file_path.exists():
            return []
        content = file_path.read_text(encoding="utf-8")
        if not content.strip():
            return []
        return json.loads(content)

    def _write_json(self, file_path: Path, data: List[Dict[str, Any]]) -> None:
        file_path.write_text(
            json.dumps(data, indent=2, ensure_ascii=False, default=str),
            encoding="utf-8"
        )

    def generate_batch_id(self) -> str:
        return f"batch_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}"

    def generate_record_id(self) -> str:
        return f"rec_{uuid.uuid4().hex[:12]}"

    def load_all_records(self) -> List[PrintRecord]:
        raw_records = self._read_json(self._records_file)
        records = []
        for raw in raw_records:
            try:
                records.append(PrintRecord(**raw))
            except Exception as e:
                print(f"警告: 跳过损坏的记录 {raw.get('record_id', 'unknown')}: {e}")
        return records

    def save_records(self, records: List[PrintRecord], batch_id: str) -> None:
        existing_records = self.load_all_records()
        existing_ids = {r.record_id for r in existing_records}

        for record in records:
            record.batch_id = batch_id
            record.updated_at = datetime.now()
            if record.record_id not in existing_ids:
                record.created_at = datetime.now()
                existing_records.append(record)
            else:
                for i, existing in enumerate(existing_records):
                    if existing.record_id == record.record_id:
                        existing_records[i] = record
                        break

        self._write_json(
            self._records_file,
            [r.model_dump(mode="json") for r in existing_records]
        )

        batch_file = self.base_dir / self.data_dirs["history"] / f"{batch_id}_records.json"
        self._write_json(batch_file, [r.model_dump(mode="json") for r in records])

    def update_record(self, record: PrintRecord) -> None:
        record.updated_at = datetime.now()
        existing_records = self.load_all_records()
        for i, existing in enumerate(existing_records):
            if existing.record_id == record.record_id:
                existing_records[i] = record
                break
        self._write_json(
            self._records_file,
            [r.model_dump(mode="json") for r in existing_records]
        )

    def find_record(self, series: str, edition_number: str) -> Optional[PrintRecord]:
        for record in self.load_all_records():
            if record.series == series and record.edition_number == edition_number:
                return record
        return None

    def find_record_by_id(self, record_id: str) -> Optional[PrintRecord]:
        for record in self.load_all_records():
            if record.record_id == record_id:
                return record
        return None

    def save_validation_result(self, result: BatchValidationResult) -> None:
        result_file = self.base_dir / self.data_dirs["history"] / f"{result.batch_id}_validation.json"
        self._write_json(result_file, [result.model_dump(mode="json")])

    def load_validation_result(self, batch_id: str) -> Optional[BatchValidationResult]:
        result_file = self.base_dir / self.data_dirs["history"] / f"{batch_id}_validation.json"
        if not result_file.exists():
            return None
        raw = self._read_json(result_file)
        if raw:
            return BatchValidationResult(**raw[0])
        return None

    def add_history_entry(self, entry: HistoryEntry) -> None:
        history = self._read_json(self._history_file)
        history.append(entry.model_dump(mode="json"))
        self._write_json(self._history_file, history)

    def load_history(self, limit: Optional[int] = None) -> List[HistoryEntry]:
        raw = self._read_json(self._history_file)
        entries = [HistoryEntry(**r) for r in raw]
        entries.sort(key=lambda e: e.timestamp, reverse=True)
        if limit:
            return entries[:limit]
        return entries

    def get_records_by_batch(self, batch_id: str) -> List[PrintRecord]:
        return [r for r in self.load_all_records() if r.batch_id == batch_id]

    def get_batch_ids(self) -> List[str]:
        batch_ids = set()
        for record in self.load_all_records():
            if record.batch_id:
                batch_ids.add(record.batch_id)
        return sorted(batch_ids)

    def save_error_report(self, batch_id: str, conflicts: List[Any]) -> Path:
        error_file = self.base_dir / self.data_dirs["errors"] / f"{batch_id}_errors.json"
        self._write_json(error_file, [c.model_dump(mode="json") for c in conflicts])
        return error_file

    def save_export_report(self, batch_id: str, data: Dict[str, Any]) -> Path:
        export_file = self.base_dir / self.data_dirs["output"] / f"{batch_id}_report.json"
        self._write_json(export_file, [data])
        return export_file

    def save_input_backup(self, batch_id: str, input_data: List[Dict[str, Any]]) -> Path:
        input_file = self.base_dir / self.data_dirs["input"] / f"{batch_id}_input.json"
        self._write_json(input_file, input_data)
        return input_file

import json
from pathlib import Path
from typing import Dict, Any, List
from datetime import datetime

from .base import BaseImporter, ImportResult
from ..models import ImportSourceType, CleaningRecord, Cleaner, RecordStatus


class CleaningRecordImporter(BaseImporter):
    REQUIRED_FIELDS = ["room_number", "cleaning_date", "cleaner_name"]

    def __init__(self, db, operator="system"):
        super().__init__(db, ImportSourceType.CLEANING_RECORD, operator)
        self._cleaner_cache = {}

    def import_file(self, file_path: str) -> ImportResult:
        file_name = Path(file_path).name

        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        records = data if isinstance(data, list) else data.get("records", [data])

        for row_num, record in enumerate(records, start=1):
            try:
                self._process_single_record(record, row_num, file_name)
            except Exception as e:
                self._save_error(
                    source_file=file_name,
                    source_row=row_num,
                    raw_data=record,
                    error_message=f"处理异常: {str(e)}",
                    suggested_fix="检查JSON格式是否正确，确保字段完整",
                )

        self.db.commit()
        return self.result

    def _get_or_create_cleaner(self, name: str) -> Cleaner:
        if not name:
            return None
        name = name.strip()
        if name in self._cleaner_cache:
            return self._cleaner_cache[name]

        cleaner = self.db.query(Cleaner).filter(Cleaner.name == name).first()
        if not cleaner:
            cleaner = Cleaner(name=name, is_active=True)
            self.db.add(cleaner)
            self.db.flush()
            self._log_audit("create", "Cleaner", cleaner.id, new_value={"name": name})

        self._cleaner_cache[name] = cleaner
        return cleaner

    def _process_single_record(self, record: Dict[str, Any], row_num: int, file_name: str) -> bool:
        missing_fields = self._validate_required(record, self.REQUIRED_FIELDS)
        if missing_fields:
            self._save_error(
                source_file=file_name,
                source_row=row_num,
                raw_data=record,
                error_message=f"缺少必填字段: {', '.join(missing_fields)}",
                suggested_fix=f"请补充以下字段: {', '.join(missing_fields)}",
            )
            return False

        cleaning_date = self._parse_date(record.get("cleaning_date", ""))
        if not cleaning_date:
            self._save_error(
                source_file=file_name,
                source_row=row_num,
                raw_data=record,
                error_message=f"保洁日期格式无效: {record.get('cleaning_date')}",
                suggested_fix="请使用 YYYY-MM-DD 或 YYYY/MM/DD 格式",
            )
            return False

        cleaner = self._get_or_create_cleaner(record.get("cleaner_name", ""))
        if not cleaner:
            self._save_error(
                source_file=file_name,
                source_row=row_num,
                raw_data=record,
                error_message="保洁员名称无效",
                suggested_fix="请提供有效的保洁员名称",
            )
            return False

        start_time = self._parse_datetime(record.get("start_time")) if record.get("start_time") else None
        end_time = self._parse_datetime(record.get("end_time")) if record.get("end_time") else None

        duration = None
        if start_time and end_time:
            duration = int((end_time - start_time).total_seconds() / 60)

        cleaning_record = CleaningRecord(
            cleaner_id=cleaner.id,
            room_number=record["room_number"],
            cleaning_date=cleaning_date,
            start_time=start_time,
            end_time=end_time,
            duration_minutes=duration,
            score=float(record["score"]) if record.get("score") else None,
            notes=record.get("notes", ""),
            source_file=file_name,
            source_row=row_num,
            status_record=RecordStatus.PENDING,
        )

        self.db.add(cleaning_record)
        self.db.flush()

        self.result.success_count += 1
        self.result.success_ids.append(cleaning_record.id)
        self._log_audit("create", "CleaningRecord", cleaning_record.id, new_value=record)

        return True

    def _parse_datetime(self, dt_str: str) -> datetime:
        if not dt_str:
            return None
        formats = [
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d %H:%M",
            "%Y/%m/%d %H:%M:%S",
            "%Y/%m/%d %H:%M",
        ]
        dt_str = str(dt_str).strip()
        for fmt in formats:
            try:
                return datetime.strptime(dt_str, fmt)
            except ValueError:
                continue
        return None

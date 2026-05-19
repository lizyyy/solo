import csv
from pathlib import Path
from typing import Dict, Any
from datetime import datetime

from .base import BaseImporter, ImportResult
from ..models import ImportSourceType, Photo, CleaningRecord, RecordStatus


class PhotoImporter(BaseImporter):
    REQUIRED_FIELDS = ["file_name", "room_number", "uploaded_at"]

    def __init__(self, db, operator="system"):
        super().__init__(db, ImportSourceType.PHOTO_LIST, operator)

    def import_file(self, file_path: str) -> ImportResult:
        file_name = Path(file_path).name

        with open(file_path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)

            for row_num, row in enumerate(reader, start=2):
                try:
                    self._process_single_record(row, row_num, file_name)
                except Exception as e:
                    self._save_error(
                        source_file=file_name,
                        source_row=row_num,
                        raw_data=row,
                        error_message=f"处理异常: {str(e)}",
                        suggested_fix="检查照片记录格式是否正确",
                    )

        self.db.commit()
        return self.result

    def _find_cleaning_record(self, room_number: str, date: datetime) -> CleaningRecord:
        if not room_number or not date:
            return None

        room_number = room_number.strip()

        record = (
            self.db.query(CleaningRecord)
            .filter(
                CleaningRecord.room_number == room_number,
                CleaningRecord.cleaning_date >= date.replace(hour=0, minute=0, second=0),
                CleaningRecord.cleaning_date <= date.replace(hour=23, minute=59, second=59),
                CleaningRecord.status_record != RecordStatus.INVALID,
            )
            .first()
        )
        return record

    def _process_single_record(self, record: Dict[str, Any], row_num: int, file_name: str) -> bool:
        record = {k.strip(): v.strip() if isinstance(v, str) else v for k, v in record.items()}

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

        uploaded_at = self._parse_datetime(record.get("uploaded_at", ""))
        if not uploaded_at:
            self._save_error(
                source_file=file_name,
                source_row=row_num,
                raw_data=record,
                error_message=f"上传时间格式无效: {record.get('uploaded_at')}",
                suggested_fix="请使用 YYYY-MM-DD HH:MM:SS 格式",
            )
            return False

        cleaning_record = self._find_cleaning_record(record["room_number"], uploaded_at)
        if not cleaning_record:
            self._save_error(
                source_file=file_name,
                source_row=row_num,
                raw_data=record,
                error_message=f"未找到对应的保洁记录: 房间 {record['room_number']}, 日期 {uploaded_at.date()}",
                suggested_fix="请先导入对应的保洁记录，或检查房间号和日期是否匹配",
            )
            return False

        photo = Photo(
            cleaning_record_id=cleaning_record.id,
            file_name=record["file_name"],
            file_path=record.get("file_path", ""),
            photo_type=record.get("photo_type", ""),
            uploaded_at=uploaded_at,
            is_valid=True,
            source_file=file_name,
            source_row=row_num,
        )

        self.db.add(photo)
        self.db.flush()

        self.result.success_count += 1
        self.result.success_ids.append(photo.id)
        self._log_audit("create", "Photo", photo.id, new_value=record)

        return True

    def _parse_datetime(self, dt_str: str) -> datetime:
        if not dt_str:
            return None
        formats = [
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d %H:%M",
            "%Y/%m/%d %H:%M:%S",
            "%Y/%m/%d %H:%M",
            "%Y-%m-%d",
        ]
        dt_str = str(dt_str).strip()
        for fmt in formats:
            try:
                return datetime.strptime(dt_str, fmt)
            except ValueError:
                continue
        return None

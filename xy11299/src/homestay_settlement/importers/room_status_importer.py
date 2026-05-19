import csv
from pathlib import Path
from typing import Dict, Any

from .base import BaseImporter, ImportResult
from ..models import ImportSourceType, RoomStatus, RecordStatus


class RoomStatusImporter(BaseImporter):
    REQUIRED_FIELDS = ["room_number", "date", "status"]

    def __init__(self, db, operator="system"):
        super().__init__(db, ImportSourceType.ROOM_STATUS, operator)

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
                        suggested_fix="检查数据格式是否正确，特别注意日期格式",
                    )

        self.db.commit()
        return self.result

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

        date_val = self._parse_date(record.get("date", ""))
        if not date_val:
            self._save_error(
                source_file=file_name,
                source_row=row_num,
                raw_data=record,
                error_message=f"日期格式无效: {record.get('date')}",
                suggested_fix="请使用 YYYY-MM-DD 或 YYYY/MM/DD 格式",
            )
            return False

        check_in = self._parse_date(record.get("check_in", "")) if record.get("check_in") else None
        check_out = self._parse_date(record.get("check_out", "")) if record.get("check_out") else None

        room_status = RoomStatus(
            room_number=record["room_number"],
            date=date_val,
            status=record["status"],
            guest_name=record.get("guest_name", ""),
            check_in=check_in,
            check_out=check_out,
            source_file=file_name,
            source_row=row_num,
            status_record=RecordStatus.PENDING,
        )

        self.db.add(room_status)
        self.db.flush()

        self.result.success_count += 1
        self.result.success_ids.append(room_status.id)
        self._log_audit("create", "RoomStatus", room_status.id, new_value=record)

        return True

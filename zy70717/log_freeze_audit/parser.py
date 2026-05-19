import csv
import json
import os
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Tuple, Optional
from dateutil import parser as date_parser

from .models import (
    AuditRecord,
    SourceInfo,
    ValidationError,
    OperationType,
    FreezeReason,
    ReleaseStatus,
)


class AuditParser:
    DATE_FORMATS = [
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%d",
        "%Y/%m/%d %H:%M:%S",
        "%Y/%m/%d",
    ]

    def __init__(self):
        self.errors: List[ValidationError] = []

    def parse_datetime(self, dt_str: str) -> Optional[datetime]:
        if not dt_str:
            return None
        try:
            return date_parser.isoparse(dt_str)
        except (ValueError, TypeError):
            try:
                for fmt in self.DATE_FORMATS:
                    try:
                        return datetime.strptime(dt_str.strip(), fmt)
                    except ValueError:
                        continue
            except Exception:
                pass
        return None

    def parse_file(self, file_path: str) -> Tuple[List[AuditRecord], List[ValidationError]]:
        self.errors = []
        records: List[AuditRecord] = []
        path = Path(file_path)

        if not path.exists():
            self.errors.append(
                ValidationError(
                    error_type="FileNotFound",
                    message=f"文件不存在: {file_path}",
                    source_info=SourceInfo(file_path=file_path, raw_content=""),
                )
            )
            return [], self.errors

        if path.suffix.lower() == ".csv":
            return self.parse_csv(file_path)
        elif path.suffix.lower() == ".json":
            return self.parse_json(file_path)
        else:
            self.errors.append(
                ValidationError(
                    error_type="UnsupportedFormat",
                    message=f"不支持的文件格式: {path.suffix}",
                    source_info=SourceInfo(file_path=file_path, raw_content=""),
                )
            )
            return [], self.errors

    def parse_csv(self, file_path: str) -> Tuple[List[AuditRecord], List[ValidationError]]:
        records: List[AuditRecord] = []
        line_num = 0

        with open(file_path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row_num, row in enumerate(reader, start=2):
                line_num = row_num
                raw_content = ",".join([f"{k}={v}" for k, v in row.items()])
                try:
                    record = self._parse_row(row, file_path, line_num, raw_content)
                    if record:
                        records.append(record)
                except Exception as e:
                    self.errors.append(
                        ValidationError(
                            error_type="ParseError",
                            message=f"解析失败: {str(e)}",
                            source_info=SourceInfo(
                                file_path=file_path,
                                line_number=line_num,
                                raw_content=raw_content,
                            ),
                        )
                    )

        return records, self.errors

    def parse_json(self, file_path: str) -> Tuple[List[AuditRecord], List[ValidationError]]:
        records: List[AuditRecord] = []

        with open(file_path, "r", encoding="utf-8") as f:
            try:
                data = json.load(f)
            except json.JSONDecodeError as e:
                self.errors.append(
                    ValidationError(
                        error_type="JSONParseError",
                        message=f"JSON解析失败: {str(e)}",
                        source_info=SourceInfo(file_path=file_path, raw_content=f"{e}"),
                    )
                )
                return [], self.errors

        if isinstance(data, dict):
            data = [data]

        for idx, item in enumerate(data):
            line_num = idx + 1
            raw_content = json.dumps(item, ensure_ascii=False)
            try:
                record = self._parse_row(item, file_path, line_num, raw_content)
                if record:
                    records.append(record)
            except Exception as e:
                self.errors.append(
                    ValidationError(
                        error_type="ParseError",
                        message=f"解析失败: {str(e)}",
                        source_info=SourceInfo(
                            file_path=file_path,
                            line_number=line_num,
                            raw_content=raw_content,
                        ),
                    )
                )

        return records, self.errors

    def _parse_row(
        self, row: Dict[str, Any], file_path: str, line_num: int, raw_content: str
    ) -> Optional[AuditRecord]:
        row = {k.lower().strip(): v for k, v in row.items()}

        record_id = row.get("id", "") or row.get("record_id", "") or f"{file_path}_{line_num}"
        if not record_id:
            record_id = f"auto_{os.path.basename(file_path)}_{line_num}"

        op_type_str = str(row.get("operation_type", "") or row.get("type", "")).lower()
        if not op_type_str:
            raise ValueError("缺少operation_type字段")
        try:
            operation_type = OperationType(op_type_str)
        except ValueError:
            raise ValueError(f"无效的操作类型: {op_type_str}")

        log_topic = str(row.get("log_topic", "") or row.get("topic", "")).strip()
        if not log_topic:
            raise ValueError("缺少log_topic字段")

        start_time_str = str(row.get("start_time", "") or row.get("start", "")).strip()
        end_time_str = str(row.get("end_time", "") or row.get("end", "")).strip()

        if not start_time_str:
            raise ValueError("缺少start_time字段")
        if not end_time_str:
            raise ValueError("缺少end_time字段")

        start_time = self.parse_datetime(start_time_str)
        end_time = self.parse_datetime(end_time_str)

        if not start_time:
            raise ValueError(f"无效的开始时间格式: {start_time_str}")
        if not end_time:
            raise ValueError(f"无效的结束时间格式: {end_time_str}")

        reason_str = str(row.get("freeze_reason", "") or row.get("reason", "")).lower()
        if not reason_str:
            raise ValueError("缺少freeze_reason字段")
        try:
            freeze_reason = FreezeReason(reason_str)
        except ValueError:
            raise ValueError(f"无效的冻结原因: {reason_str}")

        applicant = str(row.get("applicant", "")).strip()
        if not applicant:
            raise ValueError("缺少applicant字段")

        release_condition = row.get("release_condition") or row.get("condition")
        if release_condition:
            release_condition = str(release_condition).strip()

        release_status = None
        release_status_str = str(row.get("release_status", "") or "").lower()
        if release_status_str:
            try:
                release_status = ReleaseStatus(release_status_str)
            except ValueError:
                pass

        approval_time = None
        approval_time_str = str(row.get("approval_time", "") or "").strip()
        if approval_time_str:
            approval_time = self.parse_datetime(approval_time_str)

        approver = str(row.get("approver", "") or "").strip() or None

        record = AuditRecord(
            id=record_id,
            operation_type=operation_type,
            log_topic=log_topic,
            start_time=start_time,
            end_time=end_time,
            freeze_reason=freeze_reason,
            applicant=applicant,
            release_condition=release_condition,
            release_status=release_status,
            approval_time=approval_time,
            approver=approver,
            source_info=SourceInfo(
                file_path=file_path,
                line_number=line_num,
                raw_content=raw_content,
            ),
        )

        return record

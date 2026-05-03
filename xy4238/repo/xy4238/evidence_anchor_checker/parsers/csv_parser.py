"""
CSV解析器 - 解析庭审时间码CSV文件
"""

import csv
from typing import List, Dict, Any, Tuple
from pathlib import Path

from ..rules.validation_rules import (
    TimestampEntry,
    ValidationError,
    ErrorType,
    ValidationRules
)


class TimestampCSVParser:
    REQUIRED_COLUMNS = ["时间码", "发言人", "事件类型", "描述"]
    OPTIONAL_COLUMNS = ["持续时间(秒)"]

    @classmethod
    def parse(cls, file_path: str) -> Tuple[List[TimestampEntry], List[ValidationError]]:
        entries = []
        errors = []
        path = Path(file_path)

        if not path.exists():
            errors.append(ValidationError(
                error_type=ErrorType.FIELD_MISSING,
                message=f"文件不存在: {file_path}",
                location="文件系统",
                suggestion="请检查文件路径是否正确"
            ))
            return entries, errors

        with open(path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            headers = reader.fieldnames or []

            missing_columns = [col for col in cls.REQUIRED_COLUMNS if col not in headers]
            if missing_columns:
                errors.append(ValidationError(
                    error_type=ErrorType.FIELD_MISSING,
                    message=f"CSV缺少必需列: {', '.join(missing_columns)}",
                    location="CSV表头",
                    suggestion="请确保CSV包含以下列: 时间码, 发言人, 事件类型, 描述"
                ))
                return entries, errors

            for row_num, row in enumerate(reader, start=2):
                timestamp = row.get("时间码", "").strip()
                speaker = row.get("发言人", "").strip()
                event_type = row.get("事件类型", "").strip()
                description = row.get("描述", "").strip()
                duration_str = row.get("持续时间(秒)", "0").strip()

                if not timestamp:
                    errors.append(ValidationError(
                        error_type=ErrorType.FIELD_MISSING,
                        message=f"第{row_num}行缺少时间码",
                        location=f"CSV第{row_num}行",
                        suggestion="请为每一行填写时间码"
                    ))
                    continue

                valid_ts, ts_msg = ValidationRules.validate_timestamp(timestamp)
                if not valid_ts:
                    errors.append(ValidationError(
                        error_type=ErrorType.TIMESTAMP_INVALID,
                        message=ts_msg,
                        location=f"CSV第{row_num}行 - 时间码: {timestamp}",
                        suggestion="请使用 HH:MM:SS 格式"
                    ))

                try:
                    duration_seconds = int(duration_str) if duration_str else 0
                except ValueError:
                    duration_seconds = 0
                    errors.append(ValidationError(
                        error_type=ErrorType.FORMAT_ERROR,
                        message=f"持续时间格式无效: {duration_str}",
                        location=f"CSV第{row_num}行",
                        suggestion="持续时间应为整数秒数"
                    ))

                entry = TimestampEntry(
                    timestamp=timestamp,
                    speaker=speaker,
                    event_type=event_type,
                    description=description,
                    duration_seconds=duration_seconds
                )
                entries.append(entry)

        return entries, errors

    @classmethod
    def export(cls, entries: List[TimestampEntry], file_path: str) -> None:
        path = Path(file_path)
        path.parent.mkdir(parents=True, exist_ok=True)

        with open(path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=[
                "时间码", "发言人", "事件类型", "描述", "持续时间(秒)"
            ])
            writer.writeheader()
            for entry in entries:
                writer.writerow({
                    "时间码": entry.timestamp,
                    "发言人": entry.speaker,
                    "事件类型": entry.event_type,
                    "描述": entry.description,
                    "持续时间(秒)": str(entry.duration_seconds)
                })

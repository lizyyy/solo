import csv
import json
import os
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

import pandas as pd
from dateutil.parser import parse as parse_date


class InputType(Enum):
    DEVICE = "device"
    TOKEN = "token"
    BINDING = "binding"
    UNSUBSCRIBE = "unsubscribe"
    FAILURE = "failure"


class DataSource(Enum):
    CSV = "csv"
    JSON = "json"
    EXCEL = "excel"


@dataclass
class ParseError:
    row_number: int
    source_file: str
    raw_content: str
    error_message: str
    sheet_name: Optional[str] = None


@dataclass
class ParsedRecord:
    record_type: InputType
    data: Dict[str, Any]
    source_file: str
    row_number: int
    sheet_name: Optional[str] = None
    raw_content: str = ""


@dataclass
class ParseResult:
    records: List[ParsedRecord] = field(default_factory=list)
    errors: List[ParseError] = field(default_factory=list)
    source_files: List[str] = field(default_factory=list)


class InputParser:
    def __init__(self):
        self.type_mappings = {
            InputType.DEVICE: {
                "columns": ["device_id", "user_id", "platform", "last_active"],
                "aliases": {
                    "deviceid": "device_id",
                    "device": "device_id",
                    "userid": "user_id",
                    "user": "user_id",
                    "plat": "platform",
                    "os": "platform",
                    "lastactive": "last_active",
                    "active_time": "last_active",
                },
            },
            InputType.TOKEN: {
                "columns": ["token", "device_id", "user_id", "create_time", "update_time"],
                "aliases": {
                    "push_token": "token",
                    "pushtoken": "token",
                    "devicetoken": "token",
                    "device_token": "token",
                    "deviceid": "device_id",
                    "userid": "user_id",
                    "created": "create_time",
                    "updated": "update_time",
                },
            },
            InputType.BINDING: {
                "columns": ["user_id", "device_id", "token", "bind_time", "unbind_time"],
                "aliases": {
                    "userid": "user_id",
                    "deviceid": "device_id",
                    "push_token": "token",
                    "bindtime": "bind_time",
                    "unbindtime": "unbind_time",
                },
            },
            InputType.UNSUBSCRIBE: {
                "columns": ["token", "user_id", "device_id", "unsubscribe_time", "reason"],
                "aliases": {
                    "push_token": "token",
                    "userid": "user_id",
                    "deviceid": "device_id",
                    "time": "unsubscribe_time",
                    "unsub_time": "unsubscribe_time",
                },
            },
            InputType.FAILURE: {
                "columns": ["token", "user_id", "device_id", "fail_time", "error_code", "error_message"],
                "aliases": {
                    "push_token": "token",
                    "userid": "user_id",
                    "deviceid": "device_id",
                    "timestamp": "fail_time",
                    "code": "error_code",
                    "msg": "error_message",
                    "err_msg": "error_message",
                },
            },
        }

    def parse_file(self, file_path: str, input_type: InputType) -> ParseResult:
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"文件不存在: {file_path}")

        suffix = path.suffix.lower()

        if suffix == ".csv":
            return self._parse_csv(file_path, input_type)
        elif suffix in [".json", ".jsonl"]:
            return self._parse_json(file_path, input_type)
        elif suffix in [".xlsx", ".xls"]:
            return self._parse_excel(file_path, input_type)
        else:
            raise ValueError(f"不支持的文件格式: {suffix}")

    def _normalize_row(self, row: Dict[str, Any], input_type: InputType) -> Dict[str, Any]:
        config = self.type_mappings[input_type]
        normalized = {}

        row_lower = {k.lower().strip(): v for k, v in row.items()}

        for col in config["columns"]:
            if col in row_lower:
                normalized[col] = row_lower[col]
            else:
                for alias, target in config["aliases"].items():
                    if target == col and alias in row_lower:
                        normalized[col] = row_lower[alias]
                        break

        for key in ["create_time", "update_time", "bind_time", "unbind_time",
                    "unsubscribe_time", "fail_time", "last_active"]:
            if key in normalized and normalized[key]:
                try:
                    normalized[key] = self._parse_datetime(normalized[key])
                except Exception:
                    pass

        return normalized

    def _parse_datetime(self, value: Any) -> Optional[str]:
        if pd.isna(value) or value is None or str(value).strip() == "":
            return None
        try:
            dt = parse_date(str(value), fuzzy=True)
            return dt.strftime("%Y-%m-%d %H:%M:%S")
        except Exception:
            return str(value)

    def _parse_csv(self, file_path: str, input_type: InputType) -> ParseResult:
        result = ParseResult()
        result.source_files.append(file_path)

        with open(file_path, "r", encoding="utf-8-sig", newline="") as f:
            content = f.readlines()

        if not content:
            return result

        header = content[0].strip()
        reader = csv.DictReader(content)

        for row_num, row in enumerate(reader, start=2):
            raw_content = content[row_num - 1].strip() if row_num - 1 < len(content) else ""
            try:
                normalized = self._normalize_row(row, input_type)
                result.records.append(
                    ParsedRecord(
                        record_type=input_type,
                        data=normalized,
                        source_file=file_path,
                        row_number=row_num,
                        raw_content=raw_content,
                    )
                )
            except Exception as e:
                result.errors.append(
                    ParseError(
                        row_number=row_num,
                        source_file=file_path,
                        raw_content=raw_content,
                        error_message=str(e),
                    )
                )

        self._stable_sort(result.records)
        return result

    def _parse_json(self, file_path: str, input_type: InputType) -> ParseResult:
        result = ParseResult()
        result.source_files.append(file_path)

        with open(file_path, "r", encoding="utf-8") as f:
            content = f.readlines()

        records_data = []
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, list):
                    records_data = data
                elif isinstance(data, dict):
                    records_data = [data]
        except json.JSONDecodeError:
            for row_num, line in enumerate(content, start=1):
                line = line.strip()
                if not line:
                    continue
                try:
                    data = json.loads(line)
                    records_data.append((row_num, data))
                except Exception as e:
                    result.errors.append(
                        ParseError(
                            row_number=row_num,
                            source_file=file_path,
                            raw_content=line,
                            error_message=f"JSON解析失败: {str(e)}",
                        )
                    )

        if isinstance(records_data[0], tuple) if records_data else False:
            for row_num, data in records_data:
                try:
                    normalized = self._normalize_row(data, input_type)
                    result.records.append(
                        ParsedRecord(
                            record_type=input_type,
                            data=normalized,
                            source_file=file_path,
                            row_number=row_num,
                            raw_content=content[row_num - 1].strip() if row_num - 1 < len(content) else "",
                        )
                    )
                except Exception as e:
                    result.errors.append(
                        ParseError(
                            row_number=row_num,
                            source_file=file_path,
                            raw_content=content[row_num - 1].strip() if row_num - 1 < len(content) else "",
                            error_message=str(e),
                        )
                    )
        else:
            for row_num, data in enumerate(records_data, start=1):
                try:
                    normalized = self._normalize_row(data, input_type)
                    result.records.append(
                        ParsedRecord(
                            record_type=input_type,
                            data=normalized,
                            source_file=file_path,
                            row_number=row_num,
                            raw_content=json.dumps(data, ensure_ascii=False),
                        )
                    )
                except Exception as e:
                    result.errors.append(
                        ParseError(
                            row_number=row_num,
                            source_file=file_path,
                            raw_content=json.dumps(data, ensure_ascii=False) if data else "",
                            error_message=str(e),
                        )
                    )

        self._stable_sort(result.records)
        return result

    def _parse_excel(self, file_path: str, input_type: InputType) -> ParseResult:
        result = ParseResult()
        result.source_files.append(file_path)

        xl = pd.ExcelFile(file_path)

        for sheet_name in xl.sheet_names:
            df = pd.read_excel(file_path, sheet_name=sheet_name, dtype=str)

            for row_num, (_, row) in enumerate(df.iterrows(), start=2):
                row_dict = row.to_dict()
                raw_content = " | ".join([f"{k}={v}" for k, v in row_dict.items() if pd.notna(v)])
                try:
                    normalized = self._normalize_row(row_dict, input_type)
                    result.records.append(
                        ParsedRecord(
                            record_type=input_type,
                            data=normalized,
                            source_file=file_path,
                            row_number=row_num,
                            sheet_name=sheet_name,
                            raw_content=raw_content,
                        )
                    )
                except Exception as e:
                    result.errors.append(
                        ParseError(
                            row_number=row_num,
                            source_file=file_path,
                            raw_content=raw_content,
                            error_message=str(e),
                            sheet_name=sheet_name,
                        )
                    )

        self._stable_sort(result.records)
        return result

    def _stable_sort(self, records: List[ParsedRecord]) -> None:
        records.sort(key=lambda r: (r.source_file, r.row_number, r.sheet_name or ""))

    def parse_directory(self, dir_path: str, input_type: InputType, pattern: str = "*.csv") -> ParseResult:
        path = Path(dir_path)
        final_result = ParseResult()

        for file_path in sorted(path.glob(pattern)):
            if file_path.is_file():
                try:
                    sub_result = self.parse_file(str(file_path), input_type)
                    final_result.records.extend(sub_result.records)
                    final_result.errors.extend(sub_result.errors)
                    final_result.source_files.extend(sub_result.source_files)
                except Exception as e:
                    final_result.errors.append(
                        ParseError(
                            row_number=0,
                            source_file=str(file_path),
                            raw_content="",
                            error_message=f"文件解析失败: {str(e)}",
                        )
                    )

        self._stable_sort(final_result.records)
        final_result.errors.sort(key=lambda e: (e.source_file, e.row_number, e.sheet_name or ""))
        return final_result

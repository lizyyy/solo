import csv
import json
import os
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Tuple

from ..constants import REQUIRED_FIELDS
from ..exceptions import ParseError


class LogParser:
    def __init__(self):
        self.supported_formats = [".csv", ".json", ".jsonl"]

    def parse_file(self, file_path: str) -> Tuple[List[Dict[str, Any]], Dict[str, List[str]]]:
        file_ext = Path(file_path).suffix.lower()
        if file_ext not in self.supported_formats:
            raise ParseError(file_path, f"不支持的文件格式: {file_ext}")

        if not os.path.exists(file_path):
            raise ParseError(file_path, "文件不存在")

        filename = os.path.basename(file_path)
        if file_ext == ".csv":
            records, warnings = self._parse_csv(file_path)
            return records, {filename: warnings} if warnings else {}
        elif file_ext in [".json", ".jsonl"]:
            records, warnings = self._parse_json(file_path)
            return records, {filename: warnings} if warnings else {}
        else:
            raise ParseError(file_path, f"未知的文件格式: {file_ext}")

    def _parse_csv(self, file_path: str) -> Tuple[List[Dict[str, Any]], List[str]]:
        records = []
        warnings = []
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row_num, row in enumerate(reader, start=2):
                    try:
                        validated_record, record_warnings = self._validate_and_convert(
                            row, file_path, row_num
                        )
                        records.append(validated_record)
                        warnings.extend(record_warnings)
                    except Exception as e:
                        warnings.append(f"行 {row_num}: 跳过无效记录 - {str(e)}")
            return records, warnings
        except csv.Error as e:
            raise ParseError(file_path, f"CSV解析错误: {str(e)}")
        except UnicodeDecodeError:
            raise ParseError(file_path, "文件编码错误，请使用UTF-8编码")

    def _parse_json(self, file_path: str) -> Tuple[List[Dict[str, Any]], List[str]]:
        records = []
        warnings = []
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read().strip()
                if file_path.endswith(".jsonl"):
                    lines = content.split("\n")
                    for line_num, line in enumerate(lines, start=1):
                        if line.strip():
                            try:
                                row = json.loads(line)
                                validated_record, record_warnings = self._validate_and_convert(
                                    row, file_path, line_num
                                )
                                records.append(validated_record)
                                warnings.extend(record_warnings)
                            except Exception as e:
                                warnings.append(f"行 {line_num}: 跳过无效记录 - {str(e)}")
                else:
                    data = json.loads(content)
                    if isinstance(data, list):
                        for idx, row in enumerate(data):
                            try:
                                validated_record, record_warnings = self._validate_and_convert(
                                    row, file_path, idx + 1
                                )
                                records.append(validated_record)
                                warnings.extend(record_warnings)
                            except Exception as e:
                                warnings.append(f"记录 {idx + 1}: 跳过无效记录 - {str(e)}")
                    else:
                        raise ParseError(file_path, "JSON文件必须是数组格式")
            return records, warnings
        except json.JSONDecodeError as e:
            raise ParseError(file_path, f"JSON解析错误: {str(e)}")
        except UnicodeDecodeError:
            raise ParseError(file_path, "文件编码错误，请使用UTF-8编码")

    def _validate_and_convert(
        self, row: Dict[str, Any], file_path: str, row_num: int
    ) -> Tuple[Dict[str, Any], List[str]]:
        warnings = []
        validated = {}

        for field in REQUIRED_FIELDS:
            if field not in row or row[field] is None or row[field] == "":
                warnings.append(f"行 {row_num}: 字段 '{field}' 缺失或为空")
                validated[field] = None
            else:
                validated[field] = row[field]

        if validated["cost"] is not None:
            try:
                validated["cost"] = float(validated["cost"])
            except (ValueError, TypeError):
                warnings.append(f"行 {row_num}: cost字段格式错误，设置为0")
                validated["cost"] = 0.0

        if validated["budget"] is not None:
            try:
                validated["budget"] = float(validated["budget"])
            except (ValueError, TypeError):
                warnings.append(f"行 {row_num}: budget字段格式错误，设置为0")
                validated["budget"] = 0.0

        if validated["impressions"] is not None:
            try:
                validated["impressions"] = int(float(validated["impressions"]))
            except (ValueError, TypeError):
                warnings.append(f"行 {row_num}: impressions字段格式错误，设置为0")
                validated["impressions"] = 0

        if validated["clicks"] is not None:
            try:
                validated["clicks"] = int(float(validated["clicks"]))
            except (ValueError, TypeError):
                warnings.append(f"行 {row_num}: clicks字段格式错误，设置为0")
                validated["clicks"] = 0

        if validated["date"]:
            try:
                validated["date"] = self._parse_date(validated["date"])
            except ValueError:
                warnings.append(f"行 {row_num}: date字段格式错误: {validated['date']}")
                validated["date"] = None

        if validated["report_time"]:
            try:
                validated["report_time"] = self._parse_datetime(validated["report_time"])
            except ValueError:
                warnings.append(f"行 {row_num}: report_time字段格式错误: {validated['report_time']}")
                validated["report_time"] = None

        validated["_source_file"] = file_path
        validated["_row_num"] = row_num

        return validated, warnings

    def _parse_date(self, date_str: str) -> datetime:
        formats = [
            "%Y-%m-%d",
            "%Y/%m/%d",
            "%Y%m%d",
            "%d-%m-%Y",
            "%d/%m/%Y",
        ]
        for fmt in formats:
            try:
                return datetime.strptime(date_str.strip(), fmt)
            except ValueError:
                continue
        raise ValueError(f"无法解析日期: {date_str}")

    def _parse_datetime(self, dt_str: str) -> datetime:
        formats = [
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%dT%H:%M:%S",
            "%Y/%m/%d %H:%M:%S",
            "%Y%m%d %H:%M:%S",
            "%Y-%m-%d %H:%M",
            "%Y-%m-%dT%H:%M",
        ]
        for fmt in formats:
            try:
                return datetime.strptime(dt_str.strip(), fmt)
            except ValueError:
                continue
        raise ValueError(f"无法解析时间: {dt_str}")

    def parse_directory(self, dir_path: str) -> Tuple[List[Dict[str, Any]], Dict[str, List[str]]]:
        all_records = []
        all_warnings = {}

        if not os.path.isdir(dir_path):
            raise ParseError(dir_path, "不是有效的目录")

        for filename in os.listdir(dir_path):
            file_path = os.path.join(dir_path, filename)
            if os.path.isfile(file_path):
                file_ext = Path(file_path).suffix.lower()
                if file_ext in self.supported_formats:
                    try:
                        records, warnings_dict = self.parse_file(file_path)
                        all_records.extend(records)
                        for fname, warns in warnings_dict.items():
                            if warns:
                                if fname in all_warnings:
                                    all_warnings[fname].extend(warns)
                                else:
                                    all_warnings[fname] = warns
                    except Exception as e:
                        all_warnings[filename] = [f"解析失败: {str(e)}"]

        return all_records, all_warnings

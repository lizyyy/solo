import csv
from pathlib import Path
from typing import Any, Generic, TypeVar, Type
import pandas as pd
from datetime import datetime, date

from loan_extension_cli.models import SourceLocation, BaseRecord

T = TypeVar("T", bound=BaseRecord)


class BaseParser(Generic[T]):
    def __init__(self, record_class: Type[T], required_columns: list[str]):
        self.record_class = record_class
        self.required_columns = required_columns
        self.column_mapping: dict[str, str] = {}

    def parse_file(self, file_path: str) -> tuple[list[T], list[str]]:
        path = Path(file_path)
        if path.suffix.lower() in [".xlsx", ".xls"]:
            return self._parse_excel(file_path)
        elif path.suffix.lower() == ".csv":
            return self._parse_csv(file_path)
        else:
            return [], [f"不支持的文件格式: {path.suffix}"]

    def _parse_csv(self, file_path: str) -> tuple[list[T], list[str]]:
        records: list[T] = []
        errors: list[str] = []
        path = Path(file_path)

        with open(file_path, "r", encoding="utf-8-sig") as f:
            lines = f.readlines()

        if not lines:
            return records, [f"文件为空: {file_path}"]

        reader = csv.DictReader(lines)
        self.column_mapping = self._detect_columns(reader.fieldnames or [])

        missing_cols = [col for col in self.required_columns if col not in self.column_mapping]
        if missing_cols:
            errors.append(f"缺少必需列: {', '.join(missing_cols)}")
            return records, errors

        for row_idx, row in enumerate(reader, start=2):
            raw_content = lines[row_idx - 1].strip() if row_idx - 1 < len(lines) else str(row)
            source = SourceLocation(
                file_path=file_path,
                file_name=path.name,
                row_number=row_idx,
                column_mapping=self.column_mapping.copy(),
                raw_content=raw_content,
            )
            try:
                record = self._build_record(row, source)
                records.append(record)
            except Exception as e:
                errors.append(f"行 {row_idx} 解析失败: {str(e)} - {raw_content}")

        return records, errors

    def _parse_excel(self, file_path: str) -> tuple[list[T], list[str]]:
        records: list[T] = []
        errors: list[str] = []
        path = Path(file_path)

        try:
            excel_file = pd.ExcelFile(file_path)
            for sheet_name in excel_file.sheet_names:
                df = pd.read_excel(file_path, sheet_name=sheet_name, dtype=str)
                df = df.fillna("")

                self.column_mapping = self._detect_columns(df.columns.tolist())
                missing_cols = [col for col in self.required_columns if col not in self.column_mapping]
                if missing_cols:
                    errors.append(f"工作表 '{sheet_name}' 缺少必需列: {', '.join(missing_cols)}")
                    continue

                for row_idx, row in df.iterrows():
                    row_dict = row.to_dict()
                    raw_content = ", ".join([f"{k}={v}" for k, v in row_dict.items()])
                    source = SourceLocation(
                        file_path=file_path,
                        file_name=path.name,
                        sheet_name=sheet_name,
                        row_number=row_idx + 2,
                        column_mapping=self.column_mapping.copy(),
                        raw_content=raw_content,
                    )
                    try:
                        record = self._build_record(row_dict, source)
                        records.append(record)
                    except Exception as e:
                        errors.append(f"{sheet_name} 行 {row_idx + 2} 解析失败: {str(e)}")
        except Exception as e:
            errors.append(f"读取Excel文件失败: {str(e)}")

        return records, errors

    def _detect_columns(self, headers: list[str]) -> dict[str, str]:
        mapping: dict[str, str] = {}
        headers_lower = {h.lower().strip(): h for h in headers}

        for std_col in self.required_columns:
            std_col_lower = std_col.lower()
            if std_col_lower in headers_lower:
                mapping[std_col] = headers_lower[std_col_lower]
            else:
                for h in headers_lower:
                    if std_col_lower in h or h in std_col_lower:
                        mapping[std_col] = headers_lower[h]
                        break

        return mapping

    def _get_value(self, row: dict[str, Any], field: str) -> Any:
        actual_col = self.column_mapping.get(field, field)
        value = row.get(actual_col, "")
        return str(value).strip() if value is not None else ""

    def _parse_date(self, value: str) -> date:
        if not value:
            raise ValueError("日期为空")

        value = str(value).strip()

        formats = [
            "%Y-%m-%d",
            "%Y/%m/%d",
            "%Y%m%d",
            "%m/%d/%Y",
            "%d-%m-%Y",
            "%Y年%m月%d日",
        ]

        for fmt in formats:
            try:
                return datetime.strptime(value, fmt).date()
            except ValueError:
                continue

        raise ValueError(f"无法解析日期: {value}")

    def _parse_float(self, value: str) -> float:
        if not value:
            return 0.0
        value = str(value).strip().replace(",", "").replace("¥", "").replace("￥", "")
        try:
            return float(value)
        except ValueError:
            raise ValueError(f"无法解析数字: {value}")

    def _parse_int(self, value: str) -> int:
        if not value:
            return 0
        value = str(value).strip().replace(",", "")
        try:
            return int(float(value))
        except ValueError:
            raise ValueError(f"无法解析整数: {value}")

    def _build_record(self, row: dict[str, Any], source: SourceLocation) -> T:
        raise NotImplementedError("子类必须实现_build_record方法")

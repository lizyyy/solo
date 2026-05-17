import os
from abc import ABC, abstractmethod
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Tuple, Optional

import pandas as pd

from ..models import BadRow
from ..utils import DataNormalizer


class BaseParser(ABC):
    def __init__(self, file_path: str, sheet_name: Optional[str] = None):
        self.file_path = file_path
        self.sheet_name = sheet_name
        self.bad_rows: List[BadRow] = []
        self.normalizer = DataNormalizer()
        self._validate_file()

    def _validate_file(self) -> None:
        if not os.path.exists(self.file_path):
            raise FileNotFoundError(f"文件不存在: {self.file_path}")
        if not os.path.isfile(self.file_path):
            raise ValueError(f"不是文件: {self.file_path}")

    def _read_file(self) -> pd.DataFrame:
        file_ext = Path(self.file_path).suffix.lower()
        if file_ext in [".xlsx", ".xls"]:
            if self.sheet_name:
                return pd.read_excel(self.file_path, sheet_name=self.sheet_name, dtype=str)
            return pd.read_excel(self.file_path, dtype=str)
        elif file_ext == ".csv":
            return pd.read_csv(self.file_path, dtype=str, encoding="utf-8-sig")
        else:
            raise ValueError(f"不支持的文件格式: {file_ext}")

    def _add_bad_row(
        self,
        row_number: int,
        raw_data: Dict[str, Any],
        error_message: str,
    ) -> None:
        bad_row = BadRow(
            file_path=self.file_path,
            sheet_name=self.sheet_name,
            row_number=row_number,
            raw_data=raw_data,
            error_message=error_message,
        )
        self.bad_rows.append(bad_row)

    def parse(self) -> Tuple[List[Any], List[BadRow]]:
        df = self._read_file()
        items = []
        self.bad_rows = []

        for idx, row in df.iterrows():
            row_number = idx + 2
            row_dict = row.to_dict()
            try:
                item = self._parse_row(row_dict, row_number)
                if item:
                    items.append(item)
            except Exception as e:
                self._add_bad_row(row_number, row_dict, str(e))

        return items, self.bad_rows

    @abstractmethod
    def _parse_row(self, row_dict: Dict[str, Any], row_number: int) -> Optional[Any]:
        pass

    def _parse_datetime(self, value: Any, field_name: str) -> datetime:
        if pd.isna(value) or value == "":
            raise ValueError(f"{field_name}不能为空")
        try:
            if isinstance(value, datetime):
                return value
            return self.normalizer.parse_datetime(str(value))
        except Exception:
            raise ValueError(f"{field_name}格式错误: {value}")

    def _parse_int(self, value: Any, field_name: str) -> int:
        if pd.isna(value) or value == "":
            raise ValueError(f"{field_name}不能为空")
        try:
            return int(str(value).strip())
        except Exception:
            raise ValueError(f"{field_name}必须是整数: {value}")

    def _parse_float(self, value: Any, field_name: str) -> float:
        if pd.isna(value) or value == "":
            raise ValueError(f"{field_name}不能为空")
        try:
            return float(str(value).strip())
        except Exception:
            raise ValueError(f"{field_name}必须是数字: {value}")

    def _parse_str(self, value: Any, field_name: str, required: bool = True) -> str:
        if pd.isna(value):
            value = ""
        value = str(value).strip()
        if required and not value:
            raise ValueError(f"{field_name}不能为空")
        return value

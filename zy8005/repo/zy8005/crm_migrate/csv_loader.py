import csv
import os
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from dateutil import parser as date_parser


class CSVLoader:
    def __init__(self, source_dir: str):
        self.source_dir = source_dir
        self._cache: Dict[str, Tuple[List[str], List[Dict[str, Any]]]] = {}

    def load_file(
        self, filename: str, normalize_headers: bool = True
    ) -> Tuple[List[str], List[Dict[str, Any]]]:
        if filename in self._cache:
            return self._cache[filename]

        file_path = os.path.join(self.source_dir, filename)
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"CSV file not found: {file_path}")

        headers: List[str] = []
        rows: List[Dict[str, Any]] = []

        with open(file_path, "r", encoding="utf-8-sig", newline="") as f:
            reader = csv.DictReader(f)
            if reader.fieldnames:
                headers = list(reader.fieldnames)
                if normalize_headers:
                    headers = [h.strip().lower() for h in headers]
                
                for row_num, row in enumerate(reader, start=2):
                    normalized_row = {}
                    for key, value in row.items():
                        norm_key = key.strip().lower() if normalize_headers else key
                        norm_value = self._normalize_value(value)
                        normalized_row[norm_key] = norm_value
                    
                    normalized_row["_row_num"] = row_num
                    normalized_row["_source_file"] = filename
                    rows.append(normalized_row)

        self._cache[filename] = (headers, rows)
        return headers, rows

    def _normalize_value(self, value: Any) -> Any:
        if value is None:
            return None
        
        if isinstance(value, str):
            stripped = value.strip()
            if stripped == "" or stripped.lower() in ("null", "none", "nan"):
                return None
            return stripped
        
        return value

    def get_headers(self, filename: str) -> List[str]:
        headers, _ = self.load_file(filename)
        return headers

    def get_rows(self, filename: str) -> List[Dict[str, Any]]:
        _, rows = self.load_file(filename)
        return rows


class DataNormalizer:
    @staticmethod
    def normalize_email(email: Optional[str]) -> Optional[str]:
        if email is None:
            return None
        return email.strip().lower()

    @staticmethod
    def normalize_phone(phone: Optional[str]) -> Optional[str]:
        if phone is None:
            return None
        digits = "".join(c for c in phone if c.isdigit() or c == "+")
        return digits if digits else None

    @staticmethod
    def normalize_date(
        date_str: Optional[str], target_format: str = "%Y-%m-%d"
    ) -> Optional[str]:
        if date_str is None:
            return None
        
        try:
            parsed = date_parser.parse(date_str.strip(), fuzzy=True)
            return parsed.strftime(target_format)
        except (ValueError, TypeError):
            return None

    @staticmethod
    def normalize_datetime(
        datetime_str: Optional[str], target_format: str = "%Y-%m-%d %H:%M:%S"
    ) -> Optional[str]:
        if datetime_str is None:
            return None
        
        try:
            parsed = date_parser.parse(datetime_str.strip(), fuzzy=True)
            return parsed.strftime(target_format)
        except (ValueError, TypeError):
            return None

    @staticmethod
    def normalize_boolean(value: Optional[str]) -> Optional[bool]:
        if value is None:
            return None
        
        if isinstance(value, bool):
            return value
        
        lower_val = str(value).strip().lower()
        if lower_val in ("true", "yes", "y", "1", "on"):
            return True
        if lower_val in ("false", "no", "n", "0", "off"):
            return False
        return None

    @staticmethod
    def normalize_integer(value: Optional[str]) -> Optional[int]:
        if value is None:
            return None
        
        try:
            return int(float(value))
        except (ValueError, TypeError):
            return None

    @staticmethod
    def normalize_float(value: Optional[str]) -> Optional[float]:
        if value is None:
            return None
        
        try:
            return float(value)
        except (ValueError, TypeError):
            return None

import csv
from abc import ABC, abstractmethod
from dataclasses import dataclass
from pathlib import Path
from typing import List, Dict, Any, Optional


@dataclass
class ParseResult:
    success: bool
    records: List[Any]
    errors: List[str]
    warnings: List[str]
    row_count: int = 0


class BaseParser(ABC):

    @abstractmethod
    def parse_file(self, file_path: Path) -> ParseResult:
        pass

    @abstractmethod
    def parse_rows(self, rows: List[Dict[str, Any]]) -> ParseResult:
        pass

    @abstractmethod
    def get_required_columns(self) -> List[str]:
        pass

    @abstractmethod
    def get_optional_columns(self) -> List[str]:
        pass

    def validate_columns(self, headers: List[str]) -> tuple[List[str], List[str]]:
        missing = []
        extra = []
        required = self.get_required_columns()
        all_known = set(required + self.get_optional_columns())

        for col in required:
            if col not in headers:
                missing.append(col)

        for col in headers:
            if col not in all_known:
                extra.append(col)

        return missing, extra

    def _read_csv_file(self, file_path: Path) -> List[Dict[str, Any]]:
        rows = []
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                rows.append({k: v.strip() if isinstance(v, str) else v for k, v in row.items()})
        return rows

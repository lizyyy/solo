from pathlib import Path
from typing import Optional

from .base_parser import BaseParser
from .csv_parser import CsvParser
from .excel_parser import ExcelParser


class ParserFactory:
    @staticmethod
    def get_parser(file_path: str) -> BaseParser:
        path = Path(file_path)
        suffix = path.suffix.lower()

        if suffix == '.csv':
            return CsvParser()
        elif suffix in ['.xlsx', '.xls']:
            return ExcelParser()
        else:
            raise ValueError(
                f"Unsupported file format: {suffix}. "
                f"Supported formats: .csv, .xlsx, .xls"
            )

    @staticmethod
    def get_parser_by_type(file_type: str) -> BaseParser:
        file_type = file_type.lower()
        if file_type == 'csv':
            return CsvParser()
        elif file_type in ['excel', 'xlsx', 'xls']:
            return ExcelParser()
        else:
            raise ValueError(f"Unsupported parser type: {file_type}")

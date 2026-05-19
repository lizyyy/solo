import os
from typing import Optional
from .base_parser import BaseParser
from .csv_parser import CSVParser
from .excel_parser import ExcelParser
from .json_parser import JSONParser
from ..models import ParseResult


class ParserFactory:
    PARSERS = {
        ".csv": CSVParser,
        ".xlsx": ExcelParser,
        ".xls": ExcelParser,
        ".json": JSONParser,
    }

    @classmethod
    def get_parser(cls, file_path: str) -> Optional[BaseParser]:
        ext = os.path.splitext(file_path)[1].lower()
        parser_class = cls.PARSERS.get(ext)
        if parser_class:
            return parser_class(file_path)
        return None

    @classmethod
    def parse_file(cls, file_path: str) -> ParseResult:
        parser = cls.get_parser(file_path)
        if not parser:
            result = ParseResult()
            result.parse_errors.append({
                "message": f"不支持的文件格式: {file_path}",
                "file_path": file_path,
                "location": file_path,
            })
            return result
        return parser.parse()

    @classmethod
    def merge_results(cls, results: list[ParseResult]) -> ParseResult:
        merged = ParseResult()
        seen_ids = set()

        for result in results:
            for repo in result.repositories:
                if repo.id not in seen_ids:
                    merged.repositories.append(repo)
                    seen_ids.add(repo.id)
            for rule in result.branch_rules:
                if rule.id not in seen_ids:
                    merged.branch_rules.append(rule)
                    seen_ids.add(rule.id)
            for exc in result.exceptions:
                if exc.id not in seen_ids:
                    merged.exceptions.append(exc)
                    seen_ids.add(exc.id)
            for window in result.windows:
                if window.id not in seen_ids:
                    merged.windows.append(window)
                    seen_ids.add(window.id)
            for recovery in result.recoveries:
                if recovery.id not in seen_ids:
                    merged.recoveries.append(recovery)
                    seen_ids.add(recovery.id)
            merged.parse_errors.extend(result.parse_errors)

        return merged

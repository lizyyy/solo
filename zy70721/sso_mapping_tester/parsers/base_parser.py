import csv
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, List, Dict, Optional, Generic, TypeVar


T = TypeVar("T")


@dataclass
class ParseError:
    file_path: str
    line_number: int
    error_type: str
    message: str
    raw_line: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "file_path": self.file_path,
            "line_number": self.line_number,
            "error_type": self.error_type,
            "message": self.message,
            "raw_line": self.raw_line,
        }


@dataclass
class ParseResult(Generic[T]):
    items: List[T]
    errors: List[ParseError]
    file_path: str
    total_lines: int = 0

    @property
    def success(self) -> bool:
        return len(self.errors) == 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "items": [item.to_dict() if hasattr(item, "to_dict") else item for item in self.items],
            "errors": [e.to_dict() for e in self.errors],
            "file_path": self.file_path,
            "total_lines": self.total_lines,
            "success": self.success,
        }


class BaseParser(Generic[T]):
    def __init__(self, file_path: str):
        self.file_path = Path(file_path)
        self.errors: List[ParseError] = []

    def parse(self) -> ParseResult[T]:
        raise NotImplementedError

    def _add_error(self, line_number: int, error_type: str, message: str, raw_line: Optional[str] = None):
        self.errors.append(ParseError(
            file_path=str(self.file_path),
            line_number=line_number,
            error_type=error_type,
            message=message,
            raw_line=raw_line
        ))


class CsvParser(BaseParser[T]):
    def _read_csv(self) -> tuple[List[Dict[str, str]], int]:
        rows = []
        total_lines = 0
        try:
            with open(self.file_path, "r", encoding="utf-8-sig") as f:
                reader = csv.DictReader(f)
                for line_num, row in enumerate(reader, start=2):
                    total_lines = line_num
                    rows.append((line_num, row))
        except Exception as e:
            self._add_error(0, "file_error", f"读取文件失败: {str(e)}")
        return rows, total_lines


class JsonParser(BaseParser[T]):
    def _read_json(self) -> tuple[Optional[Any], int]:
        try:
            with open(self.file_path, "r", encoding="utf-8") as f:
                content = f.read()
                lines = content.count("\n") + 1
                data = json.loads(content)
                return data, lines
        except json.JSONDecodeError as e:
            self._add_error(e.lineno, "json_parse_error", f"JSON解析失败: {str(e)}")
        except Exception as e:
            self._add_error(0, "file_error", f"读取文件失败: {str(e)}")
        return None, 0

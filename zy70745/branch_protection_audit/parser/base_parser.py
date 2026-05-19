from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from datetime import datetime
from ..models import (
    ParseResult,
    SourceLocation,
    Repository,
    BranchRule,
    ExceptionApplication,
    ProtectionWindow,
    RecoveryAction,
)


class BaseParser(ABC):
    def __init__(self, file_path: str):
        self.file_path = file_path
        self.parse_errors: List[Dict[str, Any]] = []

    @abstractmethod
    def parse(self) -> ParseResult:
        pass

    def _parse_datetime(self, value: Any) -> Optional[datetime]:
        if not value:
            return None
        if isinstance(value, datetime):
            return value
        try:
            if isinstance(value, str):
                for fmt in [
                    "%Y-%m-%d %H:%M:%S",
                    "%Y-%m-%d %H:%M",
                    "%Y-%m-%d",
                    "%Y/%m/%d %H:%M:%S",
                    "%Y/%m/%d %H:%M",
                    "%Y/%m/%d",
                    "%m/%d/%Y %H:%M:%S",
                    "%m/%d/%Y",
                ]:
                    try:
                        return datetime.strptime(value.strip(), fmt)
                    except ValueError:
                        continue
        except Exception:
            pass
        return None

    def _parse_bool(self, value: Any) -> bool:
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            return value.lower() in {"true", "1", "yes", "是", "已保护"}
        return bool(value)

    def _add_error(self, message: str, location: SourceLocation, row_data: Any = None):
        error = {
            "message": message,
            "location": location.get_location_str(),
            "file_path": location.file_path,
            "sheet_name": location.sheet_name,
            "line_number": location.line_number,
            "row_index": location.row_index,
            "raw_content": location.raw_content,
            "row_data": str(row_data) if row_data else None,
        }
        self.parse_errors.append(error)

    def _stable_id(self, *parts: str) -> str:
        import hashlib
        content = "|".join(str(p) for p in parts if p)
        return hashlib.sha256(content.encode("utf-8")).hexdigest()[:16]

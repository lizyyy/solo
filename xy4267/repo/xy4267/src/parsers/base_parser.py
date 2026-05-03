from abc import ABC, abstractmethod
from typing import Any, Dict, List
from datetime import datetime


class BaseParser(ABC):
    
    @abstractmethod
    def parse(self, file_path: str) -> List[Dict[str, Any]]:
        pass
    
    def _parse_datetime(self, value: str) -> datetime:
        if not value:
            return None
        formats = [
            "%Y-%m-%d %H:%M:%S",
            "%Y/%m/%d %H:%M:%S",
            "%Y-%m-%d",
            "%Y/%m/%d",
            "%Y%m%d %H%M%S",
            "%Y%m%d",
        ]
        for fmt in formats:
            try:
                return datetime.strptime(value.strip(), fmt)
            except (ValueError, AttributeError):
                continue
        return None
    
    def _parse_float(self, value: str) -> float:
        if not value:
            return None
        try:
            return float(str(value).strip())
        except (ValueError, TypeError):
            return None
    
    def _parse_int(self, value: str) -> int:
        if not value:
            return None
        try:
            return int(str(value).strip())
        except (ValueError, TypeError):
            return None

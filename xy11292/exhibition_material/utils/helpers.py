from typing import List, Dict, Any, Optional
from datetime import datetime
import csv
import io

class Helpers:
    @staticmethod
    def parse_date(date_str: str, fmt: str = "%Y-%m-%d") -> Optional[datetime]:
        try:
            return datetime.strptime(date_str, fmt)
        except (ValueError, TypeError):
            return None
    
    @staticmethod
    def parse_datetime(dt_str: str, fmt: str = "%Y-%m-%d %H:%M:%S") -> Optional[datetime]:
        try:
            return datetime.strptime(dt_str, fmt)
        except (ValueError, TypeError):
            return None
    
    @staticmethod
    def format_date(dt: datetime, fmt: str = "%Y-%m-%d") -> str:
        return dt.strftime(fmt) if dt else ""
    
    @staticmethod
    def format_datetime(dt: datetime, fmt: str = "%Y-%m-%d %H:%M:%S") -> str:
        return dt.strftime(fmt) if dt else ""
    
    @staticmethod
    def safe_float(value: Any, default: float = 0.0) -> float:
        try:
            if value is None or value == "":
                return default
            return float(value)
        except (ValueError, TypeError):
            return default
    
    @staticmethod
    def safe_int(value: Any, default: int = 0) -> int:
        try:
            if value is None or value == "":
                return default
            return int(value)
        except (ValueError, TypeError):
            return default
    
    @staticmethod
    def safe_str(value: Any, default: str = "") -> str:
        if value is None:
            return default
        return str(value).strip()
    
    @staticmethod
    def generate_csv_content(rows: List[Dict[str, Any]], fieldnames: List[str]) -> str:
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
        return output.getvalue()
    
    @staticmethod
    def group_by_key(items: List[Dict[str, Any]], key: str) -> Dict[str, List[Dict[str, Any]]]:
        result: Dict[str, List[Dict[str, Any]]] = {}
        for item in items:
            value = item.get(key)
            if value not in result:
                result[value] = []
            result[value].append(item)
        return result
    
    @staticmethod
    def calculate_statistics(numbers: List[float]) -> Dict[str, float]:
        if not numbers:
            return {"count": 0, "sum": 0, "avg": 0, "min": 0, "max": 0}
        
        return {
            "count": len(numbers),
            "sum": sum(numbers),
            "avg": sum(numbers) / len(numbers),
            "min": min(numbers),
            "max": max(numbers)
        }

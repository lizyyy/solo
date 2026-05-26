from datetime import datetime, date
from typing import Optional, Any
import re


def parse_date(value: Any) -> Optional[datetime]:
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, date):
        return datetime.combine(value, datetime.min.time())
    if isinstance(value, str):
        value = value.strip()
        date_patterns = [
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d %H:%M",
            "%Y-%m-%d",
            "%Y/%m/%d %H:%M:%S",
            "%Y/%m/%d %H:%M",
            "%Y/%m/%d",
            "%m/%d/%Y",
            "%d/%m/%Y",
        ]
        for pattern in date_patterns:
            try:
                return datetime.strptime(value, pattern)
            except ValueError:
                continue
        try:
            timestamp = float(value)
            if timestamp > 0:
                return datetime.fromtimestamp(timestamp)
        except (ValueError, TypeError):
            pass
    return None


def parse_float(value: Any) -> float:
    if value is None or value == "":
        return 0.0
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        cleaned = re.sub(r'[^\d.-]', '', value)
        try:
            return float(cleaned) if cleaned else 0.0
        except ValueError:
            return 0.0
    return 0.0


def parse_int(value: Any) -> int:
    if value is None or value == "":
        return 0
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value)
    if isinstance(value, str):
        cleaned = re.sub(r'[^\d-]', '', value)
        try:
            return int(cleaned) if cleaned else 0
        except ValueError:
            return 0
    return 0


def parse_bool(value: Any) -> bool:
    if value is None or value == "":
        return False
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    if isinstance(value, str):
        value = value.strip().lower()
        if value in ("true", "1", "yes", "是", "y", "t"):
            return True
        if value in ("false", "0", "no", "否", "n", "f"):
            return False
    return False


def calculate_overdue_days(planned_date: Optional[datetime], actual_date: Optional[datetime]) -> int:
    if not planned_date or not actual_date:
        return 0
    delta = actual_date - planned_date
    return max(0, delta.days)


def generate_batch_no() -> str:
    now = datetime.now()
    return f"RECON{now.strftime('%Y%m%d%H%M%S')}"

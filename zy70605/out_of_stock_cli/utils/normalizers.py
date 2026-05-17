from datetime import datetime
from typing import Any


class DataNormalizer:
    DATETIME_FORMATS = [
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%Y-%m-%d",
        "%Y/%m/%d %H:%M:%S",
        "%Y/%m/%d %H:%M",
        "%Y/%m/%d",
        "%m/%d/%Y %H:%M:%S",
        "%m/%d/%Y",
    ]

    def parse_datetime(self, value: str) -> datetime:
        value = value.strip()
        for fmt in self.DATETIME_FORMATS:
            try:
                return datetime.strptime(value, fmt)
            except ValueError:
                continue
        raise ValueError(f"无法解析日期时间: {value}")

    def normalize_string(self, value: Any) -> str:
        if value is None:
            return ""
        return str(value).strip()

    def normalize_boolean(self, value: Any) -> bool:
        if isinstance(value, bool):
            return value
        if isinstance(value, (int, float)):
            return value != 0
        if isinstance(value, str):
            return value.lower() in ["true", "yes", "是", "1", "确认", "confirmed"]
        return False

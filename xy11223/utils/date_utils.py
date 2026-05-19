from datetime import datetime, timedelta
from typing import Optional, Union
from dateutil import parser


def parse_datetime(value: Union[str, datetime, None]) -> Optional[datetime]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    try:
        return parser.parse(str(value))
    except (ValueError, TypeError):
        return None


def format_datetime(dt: Optional[datetime], fmt: str = "%Y-%m-%d %H:%M:%S") -> str:
    if dt is None:
        return ""
    return dt.strftime(fmt)


def is_expired(sample_time: datetime, expire_hours: int = 48) -> bool:
    if not sample_time:
        return False
    expire_time = sample_time + timedelta(hours=expire_hours)
    return datetime.utcnow() > expire_time

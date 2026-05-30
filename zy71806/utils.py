import uuid
from datetime import datetime


def generate_id() -> str:
    return str(uuid.uuid4())[:8]


def format_datetime(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%d %H:%M:%S")


def format_amount(amount: float) -> str:
    return f"{amount:,.2f}"


def is_close(a: float, b: float, tolerance: float = 0.01) -> bool:
    return abs(a - b) <= tolerance

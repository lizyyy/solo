from datetime import datetime
import uuid


def generate_order_no(prefix: str = "RO") -> str:
    timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    random_str = str(uuid.uuid4().hex)[:6].upper()
    return f"{prefix}{timestamp}{random_str}"


def generate_alert_no() -> str:
    timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    random_str = str(uuid.uuid4().hex)[:6].upper()
    return f"ALT{timestamp}{random_str}"


def format_datetime(dt: datetime) -> str:
    if not dt:
        return ""
    return dt.strftime("%Y-%m-%d %H:%M:%S")

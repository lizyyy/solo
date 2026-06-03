import re
from datetime import datetime, timedelta
from typing import Optional


def is_pinyin(text: Optional[str]) -> bool:
    if not text or not text.strip():
        return False
    text = text.strip()
    if re.match(r'^[a-zA-Z\s]+$', text):
        return True
    if re.search(r'[\u4e00-\u9fff]', text):
        return False
    return bool(re.match(r'^[a-zA-Z0-9\s_\-]+$', text))


def is_chinese_name(text: Optional[str]) -> bool:
    if not text or not text.strip():
        return False
    text = text.strip()
    return bool(re.search(r'[\u4e00-\u9fff]', text))


def detect_pinyin_approval(approval_name: Optional[str]) -> tuple[bool, Optional[str]]:
    if not approval_name or not approval_name.strip():
        return False, None
    if is_pinyin(approval_name):
        return True, f"审批人名称'{approval_name}'疑似为拼音，需客户经理复核"
    return False, None


def add_business_days(start_date: datetime, days: int, holidays: Optional[list] = None) -> datetime:
    if holidays is None:
        holidays = []
    current = start_date
    added = 0
    while added < days:
        current += timedelta(days=1)
        if current.weekday() < 5 and current not in holidays:
            added += 1
    return current


def is_holiday(date: datetime, holidays: Optional[list] = None) -> bool:
    if holidays is None:
        holidays = []
    return date.weekday() >= 5 or date in holidays


def parse_date(value: any) -> Optional[datetime]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        for fmt in ['%Y-%m-%d', '%Y/%m/%d', '%Y%m%d', '%Y-%m-%d %H:%M:%S']:
            try:
                return datetime.strptime(value.strip(), fmt)
            except (ValueError, AttributeError):
                continue
    try:
        return datetime.fromtimestamp(float(value))
    except (ValueError, TypeError):
        return None


def format_date(date: Optional[datetime]) -> str:
    if date is None:
        return ""
    return date.strftime("%Y-%m-%d")


def format_currency(amount: Optional[float]) -> str:
    if amount is None:
        return "¥0.00"
    return f"¥{amount:,.2f}"


def generate_duplicate_key(record: dict) -> str:
    fund_code = record.get('fund_code', '') or ''
    customer_account = record.get('customer_account', '') or ''
    transaction_date = format_date(record.get('transaction_date'))
    transaction_amount = record.get('transaction_amount', 0) or 0
    return f"{fund_code}|{customer_account}|{transaction_date}|{transaction_amount:.2f}"


def safe_float(value: any, default: float = 0.0) -> float:
    if value is None:
        return default
    try:
        return float(value)
    except (ValueError, TypeError):
        return default


def safe_str(value: any, default: str = "") -> str:
    if value is None:
        return default
    return str(value).strip()


def calculate_commission(
    transaction_amount: float,
    commission_rate: float,
    trail_ratio: float = 0.3
) -> tuple[float, float]:
    commission = transaction_amount * commission_rate
    trail_commission = commission * trail_ratio
    return commission, trail_commission

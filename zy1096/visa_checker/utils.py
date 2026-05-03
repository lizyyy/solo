from datetime import date, datetime
from typing import Optional, Tuple
from dateutil.parser import parse as dateutil_parse
from dateutil.parser import ParserError


def parse_date(date_str: str, formats: Optional[list] = None) -> Tuple[Optional[date], Optional[str]]:
    if not date_str or not date_str.strip():
        return None, "日期为空"
    
    date_str = date_str.strip()
    
    default_formats = [
        "%Y-%m-%d",
        "%Y/%m/%d",
        "%d-%m-%Y",
        "%d/%m/%Y",
        "%m-%d-%Y",
        "%m/%d/%Y",
        "%Y年%m月%d日",
        "%Y.%m.%d",
    ]
    
    formats_to_try = formats or default_formats
    
    for fmt in formats_to_try:
        try:
            parsed = datetime.strptime(date_str, fmt)
            return parsed.date(), None
        except ValueError:
            continue
    
    try:
        parsed = dateutil_parse(date_str, fuzzy=False)
        return parsed.date(), None
    except ParserError:
        pass
    
    return None, f"无法解析日期: '{date_str}'"


def format_date(d: date) -> str:
    return d.strftime("%Y-%m-%d")


def days_between(start: date, end: date) -> int:
    return (end - start).days


def add_months(d: date, months: int) -> date:
    month = d.month - 1 + months
    year = d.year + month // 12
    month = month % 12 + 1
    day = d.day
    import calendar
    _, last_day = calendar.monthrange(year, month)
    day = min(day, last_day)
    return date(year, month, day)


def get_file_extension(filename: str) -> str:
    import os
    _, ext = os.path.splitext(filename)
    return ext.lower().lstrip(".")


def sanitize_filename(filename: str) -> str:
    invalid_chars = '<>:"/\\|?*'
    for char in invalid_chars:
        filename = filename.replace(char, "_")
    return filename.strip()


def generate_normalized_filename(
    applicant_id: str,
    document_type: str,
    original_extension: str,
    pattern: str = "{applicant_id}_{document_type}.{ext}"
) -> str:
    return pattern.format(
        applicant_id=applicant_id,
        document_type=document_type,
        ext=original_extension
    )

import hashlib
from datetime import datetime

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(password: str, password_hash: str) -> bool:
    return hashlib.sha256(password.encode()).hexdigest() == password_hash

def format_datetime(dt: datetime) -> str:
    if not dt:
        return ''
    return dt.strftime('%Y-%m-%d %H:%M:%S')

def parse_datetime(dt_str: str) -> datetime:
    formats = [
        '%Y-%m-%d %H:%M:%S',
        '%Y-%m-%d %H:%M',
        '%Y-%m-%d',
    ]
    for fmt in formats:
        try:
            return datetime.strptime(dt_str, fmt)
        except ValueError:
            continue
    raise ValueError(f'无法解析日期时间: {dt_str}')

def chunk_list(lst, size):
    for i in range(0, len(lst), size):
        yield lst[i:i + size]

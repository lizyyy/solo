import os
import hashlib
from datetime import datetime, date
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from .models import Base, WorkRecord, HistoricalDebt, AuditLog


def get_db_path():
    home = os.path.expanduser("~")
    db_dir = os.path.join(home, '.agri-coop-billing')
    os.makedirs(db_dir, exist_ok=True)
    return os.path.join(db_dir, 'billing.db')


def get_engine():
    db_path = get_db_path()
    return create_engine(f'sqlite:///{db_path}')


def get_session():
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    return Session()


def init_db():
    engine = get_engine()
    Base.metadata.create_all(engine)


def normalize_area(value, unit):
    unit = str(unit).strip().lower()
    if unit in ['亩', 'mu', 'mu']:
        return float(value)
    elif unit in ['公顷', 'ha']:
        return float(value) * 15
    elif unit in ['平方米', '平米', 'm2', '㎡']:
        return float(value) * 0.0015
    else:
        return float(value)


def calculate_source_hash(*args):
    content = '|'.join([str(arg) for arg in args])
    return hashlib.md5(content.encode('utf-8')).hexdigest()


def log_audit(session, action, table_name, record_id, details, operator='system'):
    log = AuditLog(
        action=action,
        table_name=table_name,
        record_id=record_id,
        details=details,
        operator=operator
    )
    session.add(log)


def parse_date(date_str):
    if isinstance(date_str, date):
        return date_str
    date_str = str(date_str).strip()
    for fmt in ['%Y-%m-%d', '%Y/%m/%d', '%Y.%m.%d', '%Y%m%d']:
        try:
            return datetime.strptime(date_str, fmt).date()
        except ValueError:
            continue
    raise ValueError(f'无法解析日期格式: {date_str}')


def safe_float(value):
    if value is None or value == '':
        return 0.0
    try:
        return float(str(value).replace(',', '').strip())
    except (ValueError, TypeError):
        return 0.0


def safe_int(value):
    if value is None or value == '':
        return 0
    try:
        return int(float(str(value).replace(',', '').strip()))
    except (ValueError, TypeError):
        return 0

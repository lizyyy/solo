import hashlib
import uuid
from datetime import datetime, date
from dateutil import parser as date_parser

def generate_batch_no():
    return f"BATCH{datetime.now().strftime('%Y%m%d%H%M%S')}"

def generate_record_hash(record_dict):
    content = '|'.join([str(v) for v in sorted(record_dict.items())])
    return hashlib.md5(content.encode('utf-8')).hexdigest()

def parse_date(date_str):
    if not date_str or str(date_str).strip() == '':
        return None
    if isinstance(date_str, date):
        return date_str
    if isinstance(date_str, datetime):
        return date_str.date()
    try:
        return date_parser.parse(str(date_str)).date()
    except:
        return None

def parse_int(value):
    if value is None or str(value).strip() == '':
        return 0
    try:
        return int(float(value))
    except:
        return 0

def parse_float(value):
    if value is None or str(value).strip() == '':
        return 0.0
    try:
        return float(value)
    except:
        return 0.0

def safe_str(value):
    if value is None:
        return ''
    return str(value).strip()

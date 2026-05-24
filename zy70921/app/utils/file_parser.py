import csv
import json
from datetime import datetime
_report_counter = 0
from typing import List, Dict, Any
import io

def parse_csv_file(content: bytes) -> List[Dict[str, Any]]:
    samples = []
    text_content = content.decode('utf-8')
    reader = csv.DictReader(io.StringIO(text_content))
    for row in reader:
        samples.append(row)
    return samples

def parse_json_file(content: bytes) -> Dict[str, List[Dict[str, Any]]]:
    return json.loads(content.decode('utf-8'))

def parse_date(date_str: str) -> datetime:
    if not date_str:
        return None
    for fmt in ['%Y-%m-%d', '%Y/%m/%d', '%Y%m%d']:
        try:
            return datetime.strptime(date_str, fmt)
        except ValueError:
            continue
    return None

def generate_report_no() -> str:
    global _report_counter
    _report_counter += 1
    now = datetime.now()
    return f"RPT{now.strftime('%Y%m%d%H%M%S')}{_report_counter:03d}"

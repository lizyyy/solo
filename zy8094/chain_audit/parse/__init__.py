import csv
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def parse_athletes(filepath: str) -> list[dict[str, Any]]:
    athletes = []
    with open(filepath, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            athletes.append({
                'athlete_id': row['athlete_id'],
                'name': row['name'],
                'sport': row['sport'],
                'nationality': row['nationality']
            })
    return athletes


def parse_jsonl(filepath: str) -> list[dict[str, Any]]:
    events = []
    with open(filepath, encoding='utf-8') as f:
        for line in f:
            if line.strip():
                events.append(json.loads(line))
    return events


def parse_handover_rules(filepath: str) -> dict[str, Any]:
    import yaml
    with open(filepath, encoding='utf-8') as f:
        rules = yaml.safe_load(f)
    return rules


def parse_lab_receipts(filepath: str) -> list[dict[str, Any]]:
    receipts = []
    with open(filepath, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            receipts.append({
                'receipt_id': row['receipt_id'],
                'sample_id': row['sample_id'],
                'received_at': row['received_at'],
                'lab_code': row['lab_code'],
                'condition': row['condition']
            })
    return receipts


def parse_timestamp(ts_str: str) -> datetime:
    ts_str = ts_str.strip()
    for fmt in [
        '%Y-%m-%dT%H:%M:%S.%f%z',
        '%Y-%m-%dT%H:%M:%S%z',
        '%Y-%m-%dT%H:%M:%S.%f',
        '%Y-%m-%dT%H:%M:%S',
        '%Y-%m-%d %H:%M:%S %z',
        '%Y-%m-%d %H:%M:%S',
    ]:
        try:
            dt = datetime.strptime(ts_str, fmt)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt
        except ValueError:
            continue
    raise ValueError(f"Cannot parse timestamp: {ts_str}")

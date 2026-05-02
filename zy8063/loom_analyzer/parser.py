import csv
import json
import yaml
from datetime import datetime
from typing import Dict, List, Any
import pandas as pd


def parse_downtime_events(csv_path: str) -> pd.DataFrame:
    df = pd.read_csv(csv_path)
    df['start_time'] = pd.to_datetime(df['start_time'])
    df['end_time'] = pd.to_datetime(df['end_time'])
    df['duration_minutes'] = (df['end_time'] - df['start_time']).dt.total_seconds() / 60
    return df


def parse_shift_schedule(json_path: str) -> List[Dict[str, Any]]:
    with open(json_path, 'r', encoding='utf-8') as f:
        shifts = json.load(f)
    for shift in shifts:
        shift['start_time'] = datetime.fromisoformat(shift['start_time'])
        shift['end_time'] = datetime.fromisoformat(shift['end_time'])
    return shifts


def parse_yarn_batches(yaml_path: str) -> List[Dict[str, Any]]:
    with open(yaml_path, 'r', encoding='utf-8') as f:
        batches = yaml.safe_load(f)
    return batches


def parse_sensor_data(jsonl_path: str) -> List[Dict[str, Any]]:
    data = []
    with open(jsonl_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line:
                record = json.loads(line)
                record['timestamp'] = datetime.fromisoformat(record['timestamp'])
                data.append(record)
    return data

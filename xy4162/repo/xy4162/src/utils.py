from datetime import datetime, timedelta
from typing import Optional, Union
import sys
import os
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import config


def parse_datetime(dt_str: str) -> Optional[datetime]:
    if not dt_str or pd.isna(dt_str):
        return None
    if isinstance(dt_str, datetime):
        return dt_str
    formats = [
        config.DATE_FORMAT,
        "%Y-%m-%d %H:%M",
        "%Y/%m/%d %H:%M:%S",
        "%Y/%m/%d %H:%M",
        "%Y-%m-%d",
        "%Y/%m/%d"
    ]
    for fmt in formats:
        try:
            return datetime.strptime(str(dt_str), fmt)
        except (ValueError, TypeError):
            continue
    return None


def format_datetime(dt: Optional[datetime], fmt: str = None) -> str:
    if dt is None:
        return ""
    if fmt is None:
        fmt = config.DATE_FORMAT
    return dt.strftime(fmt)


def calculate_time_diff(dt1: Optional[datetime], dt2: Optional[datetime]) -> Optional[timedelta]:
    if dt1 is None or dt2 is None:
        return None
    return abs(dt2 - dt1)


def format_timedelta(td: Optional[timedelta]) -> str:
    if td is None:
        return ""
    total_seconds = int(td.total_seconds())
    hours = total_seconds // 3600
    minutes = (total_seconds % 3600) // 60
    if hours > 0:
        return f"{hours}小时{minutes}分钟"
    return f"{minutes}分钟"


def ensure_datetime_columns(df: pd.DataFrame, columns: list) -> pd.DataFrame:
    df = df.copy()
    for col in columns:
        if col in df.columns:
            df[col] = df[col].apply(parse_datetime)
    return df

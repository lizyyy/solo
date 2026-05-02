from datetime import datetime, timedelta
from typing import Optional
from ..parsers.rules import RaceRules


def parse_time_str(time_str: str) -> timedelta:
    parts = list(map(int, time_str.split(':')))
    if len(parts) == 3:
        h, m, s = parts
        return timedelta(hours=h, minutes=m, seconds=s)
    elif len(parts) == 2:
        m, s = parts
        return timedelta(minutes=m, seconds=s)
    return timedelta()


def format_timedelta(td: timedelta) -> str:
    total_seconds = int(td.total_seconds())
    hours = total_seconds // 3600
    minutes = (total_seconds % 3600) // 60
    seconds = total_seconds % 60
    return f"{hours:02d}:{minutes:02d}:{seconds:02d}"


def calculate_segment_time(start: Optional[datetime], end: Optional[datetime], rules: RaceRules) -> Optional[timedelta]:
    if not start or not end:
        return None
    diff = end - start
    if rules.cross_day and diff.days < 0:
        diff = end + timedelta(days=1) - start
    return diff


def check_cutoff(arrival: Optional[datetime], start: Optional[datetime], cutoff_str: str, rules: RaceRules) -> bool:
    if not arrival or not start:
        return False
    segment_time = calculate_segment_time(start, arrival, rules)
    if not segment_time:
        return False
    cutoff = parse_time_str(cutoff_str)
    return segment_time > cutoff


def normalize_mat_id(mat_id: str, rules: RaceRules) -> str:
    if rules.mat_alias and mat_id in rules.mat_alias:
        return rules.mat_alias[mat_id]
    return mat_id

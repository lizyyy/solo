import yaml
from dataclasses import dataclass
from datetime import date, time, datetime, timedelta
from typing import Set, Dict, Optional


@dataclass
class CalendarConfig:
    holidays: Set[date]
    operating_day_cutoff: time
    operating_day_start: time


def parse_calendar_config(file_path: str) -> CalendarConfig:
    with open(file_path, 'r', encoding='utf-8') as f:
        data = yaml.safe_load(f)
    
    holidays = set()
    for holiday_str in data.get('holidays', []):
        holidays.add(date.fromisoformat(holiday_str))
    
    cutoff_parts = data.get('operating_day_cutoff', '02:00').split(':')
    cutoff = time(int(cutoff_parts[0]), int(cutoff_parts[1]))
    
    start_parts = data.get('operating_day_start', '05:00').split(':')
    start = time(int(start_parts[0]), int(start_parts[1]))
    
    return CalendarConfig(
        holidays=holidays,
        operating_day_cutoff=cutoff,
        operating_day_start=start,
    )


def get_operating_day(dt: datetime, cutoff: time) -> date:
    if dt.time() < cutoff:
        return dt.date() - timedelta(days=1)
    return dt.date()

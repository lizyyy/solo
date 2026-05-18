import csv
import os
from datetime import datetime, timedelta
from typing import Set, Dict, Optional
from pathlib import Path

class HolidayManager:
    def __init__(self, config: Dict):
        self.config = config
        self.holidays: Set[datetime] = set()
        self.holiday_names: Dict[datetime, str] = {}
        self._load_holidays()
    
    def _load_holidays(self):
        holiday_file = self.config.get('holiday_file')
        if not holiday_file:
            return
        
        holiday_path = Path(__file__).parent.parent / holiday_file
        
        if not os.path.exists(holiday_path):
            return
        
        try:
            with open(holiday_path, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    date_str = row.get('date', '')
                    name = row.get('name', '')
                    try:
                        holiday_date = datetime.strptime(date_str, '%Y-%m-%d')
                        self.holidays.add(holiday_date)
                        self.holiday_names[holiday_date] = name
                    except ValueError:
                        continue
        except Exception:
            pass
    
    def is_holiday(self, date: datetime) -> bool:
        date_only = datetime(date.year, date.month, date.day)
        return date_only in self.holidays
    
    def is_weekend(self, date: datetime) -> bool:
        return date.weekday() >= 5
    
    def is_workday(self, date: datetime) -> bool:
        return not (self.is_holiday(date) or self.is_weekend(date))
    
    def calculate_destruction_date(self, production_date: datetime, retention_days: int) -> Dict:
        current_date = production_date
        workdays_count = 0
        skipped_dates = []
        
        while workdays_count < retention_days:
            current_date += timedelta(days=1)
            if self.is_workday(current_date):
                workdays_count += 1
            else:
                skipped_dates.append({
                    'date': current_date.strftime('%Y-%m-%d'),
                    'reason': self._get_date_reason(current_date)
                })
        
        return {
            'destruction_date': current_date,
            'skipped_dates': skipped_dates,
            'actual_calendar_days': (current_date - production_date).days
        }
    
    def _get_date_reason(self, date: datetime) -> str:
        date_only = datetime(date.year, date.month, date.day)
        if date_only in self.holiday_names:
            return f"{self.holiday_names[date_only]}（节假日）"
        elif date.weekday() == 5:
            return "周六"
        elif date.weekday() == 6:
            return "周日"
        return "非工作日"

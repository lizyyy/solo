from datetime import date, timedelta
from typing import Set, List, Dict, Tuple
import json
import os

from models import TradingCalendar


class CalendarManager:
    def __init__(self, data_dir: str = "./data"):
        self.data_dir = data_dir
        self.calendars: Dict[str, TradingCalendar] = {}

    def create_china_holidays_2025(self) -> TradingCalendar:
        holidays = set()
        
        holidays.add(date(2025, 1, 1))
        for i in range(28, 31 + 1):
            holidays.add(date(2025, 1, i))
        for i in range(1, 4 + 1):
            holidays.add(date(2025, 2, i))
        
        for i in range(4, 6 + 1):
            holidays.add(date(2025, 4, i))
        
        for i in range(1, 5 + 1):
            holidays.add(date(2025, 5, i))
        
        for i in range(1, 3 + 1):
            holidays.add(date(2025, 10, i))
        
        special_trading_days = set()
        special_trading_days.add(date(2025, 1, 26))
        special_trading_days.add(date(2025, 2, 8))
        special_trading_days.add(date(2025, 4, 27))
        special_trading_days.add(date(2025, 9, 28))
        special_trading_days.add(date(2025, 10, 11))

        return TradingCalendar(
            calendar_id="CN_2025",
            year=2025,
            holidays=holidays,
            special_trading_days=special_trading_days
        )

    def create_china_holidays_2026(self) -> TradingCalendar:
        holidays = set()
        
        holidays.add(date(2026, 1, 1))
        
        for i in range(16, 22 + 1):
            holidays.add(date(2026, 2, i))
        
        for i in range(1, 5 + 1):
            holidays.add(date(2026, 5, i))
        
        for i in range(25, 27 + 1):
            holidays.add(date(2026, 6, i))
        
        for i in range(1, 7 + 1):
            holidays.add(date(2026, 10, i))

        special_trading_days = set()
        special_trading_days.add(date(2026, 2, 15))
        special_trading_days.add(date(2026, 2, 28))
        special_trading_days.add(date(2026, 9, 27))
        special_trading_days.add(date(2026, 10, 10))

        return TradingCalendar(
            calendar_id="CN_2026",
            year=2026,
            holidays=holidays,
            special_trading_days=special_trading_days
        )

    def get_calendar(self, year: int) -> TradingCalendar:
        key = f"CN_{year}"
        if key not in self.calendars:
            if year == 2025:
                self.calendars[key] = self.create_china_holidays_2025()
            elif year == 2026:
                self.calendars[key] = self.create_china_holidays_2026()
            else:
                self.calendars[key] = TradingCalendar(
                    calendar_id=key,
                    year=year,
                    holidays=set(),
                    special_trading_days=set()
                )
        return self.calendars[key]

    def validate_application_date(self, app_date: date, calendar: TradingCalendar) -> Tuple[bool, str]:
        if not calendar.is_trading_day(app_date):
            next_trading = calendar.get_next_trading_day(app_date)
            if app_date.weekday() >= 5:
                reason = f"申请日期{app_date}是周末"
            elif app_date in calendar.holidays:
                reason = f"申请日期{app_date}是节假日"
            else:
                reason = f"申请日期{app_date}是非交易日"
            return False, f"{reason}，将顺延至下一交易日{next_trading}"
        return True, "日期有效"

    def get_trading_days_between(self, start: date, end: date, calendar: TradingCalendar) -> List[date]:
        trading_days = []
        current = start
        while current <= end:
            if calendar.is_trading_day(current):
                trading_days.append(current)
            current = date.fromordinal(current.toordinal() + 1)
        return trading_days

    def count_trading_days(self, start: date, end: date, calendar: TradingCalendar) -> int:
        return len(self.get_trading_days_between(start, end, calendar))

    def save_calendar(self, calendar: TradingCalendar) -> str:
        os.makedirs(self.data_dir, exist_ok=True)
        file_path = os.path.join(self.data_dir, f"calendar_{calendar.calendar_id}.json")
        
        data = {
            "calendar_id": calendar.calendar_id,
            "year": calendar.year,
            "holidays": [d.isoformat() for d in calendar.holidays],
            "special_trading_days": [d.isoformat() for d in calendar.special_trading_days]
        }
        
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        return file_path

    def load_calendar(self, calendar_id: str) -> TradingCalendar:
        file_path = os.path.join(self.data_dir, f"calendar_{calendar_id}.json")
        
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        return TradingCalendar(
            calendar_id=data["calendar_id"],
            year=data["year"],
            holidays={date.fromisoformat(d) for d in data["holidays"]},
            special_trading_days={date.fromisoformat(d) for d in data["special_trading_days"]}
        )


class CalendarValidator:
    def __init__(self, calendar: TradingCalendar):
        self.calendar = calendar
        self.validation_log: List[Dict] = []

    def check_holiday_coverage(self, month: int, expected_holidays: int) -> Dict:
        month_holidays = [d for d in self.calendar.holidays if d.month == month]
        is_complete = len(month_holidays) == expected_holidays
        
        result = {
            "check_type": "holiday_coverage",
            "month": month,
            "expected": expected_holidays,
            "actual": len(month_holidays),
            "is_complete": is_complete,
            "holidays": [d.isoformat() for d in month_holidays]
        }
        
        self.validation_log.append(result)
        return result

    def find_missing_holidays(self, known_holidays: Set[date]) -> List[date]:
        missing = known_holidays - self.calendar.holidays
        if missing:
            self.validation_log.append({
                "check_type": "missing_holidays",
                "missing_dates": [d.isoformat() for d in sorted(missing)],
                "severity": "HIGH"
            })
        return list(missing)

    def get_validation_report(self) -> Dict:
        errors = [log for log in self.validation_log if not log.get("is_complete", True)]
        warnings = [log for log in self.validation_log if log.get("severity") == "HIGH"]
        
        return {
            "total_checks": len(self.validation_log),
            "errors": len(errors),
            "warnings": len(warnings),
            "details": self.validation_log,
            "next_steps": [
                "请核对缺失的节假日日期",
                "检查特殊交易日是否需要补班",
                "验证月底最后一天是否为交易日"
            ] if errors or warnings else ["日历校验通过"]
        }

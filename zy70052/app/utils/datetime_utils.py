from datetime import datetime, date, timedelta
from dateutil.relativedelta import relativedelta
import pytz


class DateTimeUtils:
    DEFAULT_TZ = pytz.UTC
    
    @staticmethod
    def now() -> datetime:
        return datetime.now(DateTimeUtils.DEFAULT_TZ)
    
    @staticmethod
    def now_naive() -> datetime:
        return DateTimeUtils.now().replace(tzinfo=None)
    
    @staticmethod
    def today() -> date:
        return date.today()
    
    @staticmethod
    def add_months(dt: datetime, months: int) -> datetime:
        return dt + relativedelta(months=months)
    
    @staticmethod
    def add_days(dt: datetime, days: int) -> datetime:
        return dt + timedelta(days=days)
    
    @staticmethod
    def diff_days(dt1: datetime, dt2: datetime) -> int:
        delta = dt1.replace(tzinfo=None) - dt2.replace(tzinfo=None)
        return delta.days
    
    @staticmethod
    def is_overdue(due_date: datetime, compare_date: datetime = None) -> bool:
        if compare_date is None:
            compare_date = DateTimeUtils.now_naive()
        return compare_date > due_date.replace(tzinfo=None)
    
    @staticmethod
    def get_month_end(dt: datetime) -> datetime:
        next_month = dt.replace(day=28) + timedelta(days=4)
        return (next_month - timedelta(days=next_month.day)).replace(
            hour=23, minute=59, second=59, microsecond=0
        )
    
    @staticmethod
    def format_datetime(dt: datetime, fmt: str = "%Y-%m-%d %H:%M:%S") -> str:
        return dt.strftime(fmt)
    
    @staticmethod
    def parse_datetime(dt_str: str, fmt: str = "%Y-%m-%d %H:%M:%S") -> datetime:
        return datetime.strptime(dt_str, fmt)
    
    @staticmethod
    def get_first_day_of_month(dt: datetime) -> datetime:
        return dt.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    @staticmethod
    def get_last_day_of_month(dt: datetime) -> datetime:
        return DateTimeUtils.get_month_end(dt)
    
    @staticmethod
    def calculate_days_between(start: datetime, end: datetime) -> int:
        start_naive = start.replace(tzinfo=None)
        end_naive = end.replace(tzinfo=None)
        delta = end_naive - start_naive
        return delta.days

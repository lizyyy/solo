from dataclasses import dataclass
from datetime import date
from enum import Enum
from typing import List, Optional


class HolidayRuleType(Enum):
    FIXED_DATE = "fixed_date"
    WEEKDAY = "weekday"
    OBSERVED = "observed"
    CUSTOM = "custom"


@dataclass
class HolidayRule:
    jurisdiction: str
    name: str
    rule_type: HolidayRuleType
    month: Optional[int] = None
    day: Optional[int] = None
    weekday: Optional[int] = None
    week: Optional[int] = None
    custom_dates: List[date] = None
    
    def __post_init__(self):
        if self.custom_dates is None:
            self.custom_dates = []
    
    def is_holiday(self, check_date: date) -> bool:
        if self.rule_type == HolidayRuleType.FIXED_DATE:
            return (check_date.month == self.month and 
                    check_date.day == self.day)
        
        if self.rule_type == HolidayRuleType.WEEKDAY:
            if (check_date.month == self.month and 
                check_date.weekday() == self.weekday):
                week_in_month = (check_date.day - 1) // 7 + 1
                return week_in_month == self.week
            return False
        
        if self.rule_type == HolidayRuleType.CUSTOM:
            return check_date in self.custom_dates
        
        return False


@dataclass
class HolidayCalendar:
    jurisdiction: str
    holidays: List[date]
    
    def is_holiday(self, check_date: date) -> bool:
        return check_date in self.holidays
    
    def is_weekend(self, check_date: date) -> bool:
        return check_date.weekday() >= 5
    
    def is_business_day(self, check_date: date) -> bool:
        return not self.is_weekend(check_date) and not self.is_holiday(check_date)

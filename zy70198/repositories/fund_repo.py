from datetime import date
from typing import Dict, List, Optional

from models import FundCalendar, FundCalendarEntry, FundStatus


class FundRepository:
    def __init__(self):
        self._calendars: Dict[str, FundCalendar] = {}
        self._entries: Dict[str, FundCalendarEntry] = {}

    def save_calendar(self, calendar: FundCalendar) -> None:
        self._calendars[calendar.id] = calendar

    def get_calendar_by_id(self, calendar_id: str) -> Optional[FundCalendar]:
        return self._calendars.get(calendar_id)

    def get_calendar_by_year(self, fiscal_year: int) -> Optional[FundCalendar]:
        for cal in self._calendars.values():
            if cal.fiscal_year == fiscal_year:
                return cal
        return None

    def get_all_calendars(self) -> List[FundCalendar]:
        return list(self._calendars.values())

    def save_entry(self, entry: FundCalendarEntry) -> None:
        self._entries[entry.id] = entry

    def get_entry_by_id(self, entry_id: str) -> Optional[FundCalendarEntry]:
        return self._entries.get(entry_id)

    def get_by_date(self, target_date: date) -> Optional[FundCalendarEntry]:
        for entry in self._entries.values():
            if entry.calendar_date == target_date:
                return entry
        return None

    def get_by_date_range(self, start_date: date, end_date: date) -> List[FundCalendarEntry]:
        return [entry for entry in self._entries.values() 
                if start_date <= entry.calendar_date <= end_date]

    def get_available_entries(self) -> List[FundCalendarEntry]:
        return [entry for entry in self._entries.values() 
                if entry.status in [FundStatus.AVAILABLE, FundStatus.PARTIALLY_USED]]

    def get_all_entries(self) -> List[FundCalendarEntry]:
        return list(self._entries.values())

    def delete_entry(self, entry_id: str) -> bool:
        if entry_id in self._entries:
            del self._entries[entry_id]
            return True
        return False

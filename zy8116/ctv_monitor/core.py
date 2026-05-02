"""Core data models and date handling utilities."""

from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional, Set
import logging
import pytz

logger = logging.getLogger(__name__)


class DeviationType(Enum):
    MISSED_VISIT = "missed_visit"
    EARLY_VISIT = "early_visit"
    LATE_VISIT = "late_visit"
    DUPLICATE_VISIT = "duplicate_visit"
    AMENDMENT_CROSSING = "amendment_crossing"
    SAME_DAY_MULTIPLE_VISITS = "same_day_multiple_visits"


@dataclass
class Subject:
    subject_id: str
    site_id: str
    enrollment_date: date
    enrollment_tz: str = "UTC"
    protocol_version_at_enrollment: str = "1.0"

    def get_enrollment_utc(self) -> datetime:
        """Convert enrollment date to UTC datetime."""
        tz = pytz.timezone(self.enrollment_tz)
        local_dt = tz.localize(datetime.combine(self.enrollment_date, datetime.min.time()))
        return local_dt.astimezone(pytz.UTC)


@dataclass
class Visit:
    subject_id: str
    visit_name: str
    visit_date: date
    visit_timezone: str = "UTC"
    is_missed: bool = False
    raw_record: Dict[str, Any] = field(default_factory=dict)

    def get_visit_utc(self) -> datetime:
        """Convert visit date to UTC datetime."""
        tz = pytz.timezone(self.visit_timezone)
        local_dt = tz.localize(datetime.combine(self.visit_date, datetime.min.time()))
        return local_dt.astimezone(pytz.UTC)

    def days_since_enrollment(self, subject: Subject) -> int:
        """Calculate days since enrollment (inclusive)."""
        enroll_utc = subject.get_enrollment_utc().date()
        visit_utc = self.get_visit_utc().date()
        return (visit_utc - enroll_utc).days


@dataclass
class ProtocolWindow:
    visit_name: str
    protocol_version: str
    target_days: int
    window_early_days: int
    window_late_days: int
    is_mandatory: bool = True

    def get_allowed_range(self, enrollment_date: date) -> tuple[date, date]:
        """Calculate allowed date range based on enrollment date."""
        target_date = enrollment_date + timedelta(days=self.target_days)
        early_bound = target_date - timedelta(days=self.window_early_days)
        late_bound = target_date + timedelta(days=self.window_late_days)
        return (early_bound, late_bound)


@dataclass
class Amendment:
    amendment_id: str
    protocol_version: str
    effective_date: date
    effective_tz: str = "UTC"
    description: str = ""
    visit_changes: List[Dict[str, Any]] = field(default_factory=list)

    def get_effective_utc(self) -> datetime:
        """Convert effective date to UTC datetime."""
        tz = pytz.timezone(self.effective_tz)
        local_dt = tz.localize(datetime.combine(self.effective_date, datetime.min.time()))
        return local_dt.astimezone(pytz.UTC)

    def affects_subject(self, subject: Subject) -> bool:
        """Check if this amendment affects a subject based on enrollment date."""
        return subject.get_enrollment_utc() >= self.get_effective_utc()


@dataclass
class Deviation:
    deviation_id: str
    subject_id: str
    site_id: str
    deviation_type: DeviationType
    visit_name: Optional[str]
    actual_date: Optional[date]
    expected_start: Optional[date]
    expected_end: Optional[date]
    days_off_target: Optional[int]
    protocol_version: str
    amendment_id: Optional[str]
    description: str
    severity: str = "medium"
    raw_visit_records: List[Dict[str, Any]] = field(default_factory=list)


class DateParser:
    """Utility for parsing dates with timezone support."""

    @staticmethod
    def parse_date(date_str: str, timezone: str = "UTC") -> date:
        """Parse a date string and normalize to UTC."""
        formats = [
            "%Y-%m-%d",
            "%Y/%m/%d",
            "%d-%b-%Y",
            "%b-%d-%Y",
            "%m/%d/%Y",
            "%d/%m/%Y",
        ]
        
        dt = None
        for fmt in formats:
            try:
                dt = datetime.strptime(date_str.strip(), fmt)
                break
            except ValueError:
                continue
        
        if dt is None:
            raise ValueError(f"Unable to parse date: {date_str}")
        
        tz = pytz.timezone(timezone)
        local_dt = tz.localize(dt)
        utc_dt = local_dt.astimezone(pytz.UTC)
        return utc_dt.date()

    @staticmethod
    def parse_date_with_fallback(date_str: str, timezone: str = "UTC") -> Optional[date]:
        """Parse date with None fallback on failure."""
        try:
            return DateParser.parse_date(date_str, timezone)
        except ValueError:
            logger.warning(f"Failed to parse date: {date_str}")
            return None

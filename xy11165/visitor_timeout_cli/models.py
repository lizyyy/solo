from dataclasses import dataclass
from datetime import datetime
from typing import Optional

@dataclass
class VisitorRecord:
    visitor_id: str
    visitor_name: str
    company: str
    visit_floor: str
    checkin_time: datetime
    checkout_time: Optional[datetime] = None
    is_cross_floor: bool = False
    is_manual_release: bool = False
    remarks: str = ""

@dataclass
class TimeoutResult:
    visitor_id: str
    visitor_name: str
    company: str
    visit_floor: str
    checkin_time: str
    checkout_time: str
    timeout_duration_minutes: int
    is_cross_floor: bool
    is_manual_release: bool
    remarks: str

OUTPUT_COLUMNS = [
    "visitor_id",
    "visitor_name",
    "company",
    "visit_floor",
    "checkin_time",
    "checkout_time",
    "timeout_duration_minutes",
    "is_cross_floor",
    "is_manual_release",
    "remarks"
]

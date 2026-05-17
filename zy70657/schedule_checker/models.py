from dataclasses import dataclass, field
from datetime import datetime, date
from typing import List, Dict, Any, Optional
from enum import Enum


class IssueType(Enum):
    PERSON_CONFLICT = "person_conflict"
    SCRIPT_MISSING = "script_missing"
    BAD_ROW = "bad_row"


class ScriptType(Enum):
    FIELD_CONTROL = "field_control"
    PRODUCT = "product"


@dataclass
class SourceLocation:
    file_path: str
    sheet_name: Optional[str] = None
    row_number: int = 0
    original_content: str = ""


@dataclass
class ScheduleRow:
    source: SourceLocation
    date: Optional[date] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    anchor: str = ""
    account: str = ""
    field_control: str = ""
    product_script: str = ""
    is_valid: bool = True
    parse_errors: List[str] = field(default_factory=list)


@dataclass
class TimeSlot:
    date: date
    start_time: str
    end_time: str
    start_dt: datetime
    end_dt: datetime


@dataclass
class Issue:
    issue_type: IssueType
    severity: str
    message: str
    sources: List[SourceLocation] = field(default_factory=list)
    details: Dict[str, Any] = field(default_factory=dict)


@dataclass
class CheckResult:
    schedule_rows: List[ScheduleRow] = field(default_factory=list)
    issues: List[Issue] = field(default_factory=list)
    account_stats: Dict[str, Any] = field(default_factory=dict)
    person_stats: Dict[str, Any] = field(default_factory=dict)

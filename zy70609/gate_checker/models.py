from dataclasses import dataclass, field
from datetime import datetime, date
from typing import Optional, List, Dict, Any
from enum import Enum


class PersonType(Enum):
    EMPLOYEE = "employee"
    VISITOR = "visitor"
    CONTRACTOR = "contractor"


class TrainingStatus(Enum):
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    PASSED = "passed"
    EXPIRED = "expired"


class EventType(Enum):
    ENTRY = "entry"
    EXIT = "exit"


class RuleResultType(Enum):
    PASS = "pass"
    WARN = "warn"
    BLOCK = "block"


@dataclass
class SourceInfo:
    file_path: str
    sheet_name: Optional[str] = None
    row_number: int = 0
    raw_content: str = ""


@dataclass
class PersonProfile:
    person_id: str
    name: str
    id_card: str
    person_type: PersonType
    department: str = ""
    phone: str = ""
    source_info: Optional[SourceInfo] = None


@dataclass
class GateEvent:
    event_id: str
    person_id: str
    name: str
    event_time: datetime
    gate_name: str
    event_type: EventType
    source_info: Optional[SourceInfo] = None
    is_duplicate: bool = False
    duplicate_of: Optional[str] = None


@dataclass
class VisitorApplication:
    application_id: str
    person_id: str
    name: str
    visitor_company: str
    start_time: datetime
    end_time: datetime
    approved: bool = True
    source_info: Optional[SourceInfo] = None


@dataclass
class TrainingRecord:
    record_id: str
    person_id: str
    name: str
    training_name: str
    status: TrainingStatus
    valid_until: Optional[date] = None
    source_info: Optional[SourceInfo] = None


@dataclass
class BlacklistRecord:
    blacklist_id: str
    person_id: str
    name: str
    reason: str
    added_time: datetime
    is_active: bool = True
    source_info: Optional[SourceInfo] = None


@dataclass
class RuleResult:
    rule_name: str
    result_type: RuleResultType
    message: str
    details: Dict[str, Any] = field(default_factory=dict)


@dataclass
class CheckResult:
    event: GateEvent
    person: Optional[PersonProfile] = None
    visitor_app: Optional[VisitorApplication] = None
    training_records: List[TrainingRecord] = field(default_factory=list)
    blacklist_records: List[BlacklistRecord] = field(default_factory=list)
    rule_results: List[RuleResult] = field(default_factory=list)
    final_status: RuleResultType = RuleResultType.PASS
    final_message: str = ""


@dataclass
class BadRecord:
    source_info: SourceInfo
    error_type: str
    error_message: str

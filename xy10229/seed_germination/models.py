from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any
from datetime import date, datetime
from enum import Enum


class RecordType(Enum):
    DAILY = "daily"
    BACKFILL = "backfill"


class RecordStatus(Enum):
    NORMAL = "normal"
    MISSING = "missing"
    BACKFILLED = "backfilled"
    DUPLICATE = "duplicate"
    INVALID = "invalid"


@dataclass
class DailyRecord:
    group_id: str
    experiment_date: date
    germinated_count: int
    total_seeds: int
    record_type: RecordType = RecordType.DAILY
    record_date: Optional[date] = None
    notes: str = ""
    operator: str = ""
    raw_line: str = ""
    status: RecordStatus = RecordStatus.NORMAL
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)

    def __post_init__(self):
        if self.record_date is None:
            self.record_date = self.experiment_date


@dataclass
class ExperimentGroup:
    group_id: str
    group_name: str
    total_seeds: int
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    records: List[DailyRecord] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class GerminationStats:
    group_id: str
    total_seeds: int
    total_germinated: int
    germination_rate: float
    final_date: date
    mean_germination_days: float
    germination_speed_index: float
    daily_rates: Dict[date, float]
    cumulative_rates: Dict[date, float]
    valid_days: int
    missing_days: int
    backfilled_days: int


@dataclass
class AuditFinding:
    finding_type: str
    group_id: str
    experiment_date: Optional[date]
    severity: str
    message: str
    details: Dict[str, Any] = field(default_factory=dict)


@dataclass
class AuditReport:
    findings: List[AuditFinding]
    total_records: int
    valid_records: int
    invalid_records: int
    missing_records: int
    backfilled_records: int
    summary: Dict[str, Any] = field(default_factory=dict)


@dataclass
class AnalysisResult:
    groups: Dict[str, ExperimentGroup]
    statistics: Dict[str, GerminationStats]
    audit_report: AuditReport
    generation_time: datetime = field(default_factory=datetime.now)

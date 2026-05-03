from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional, Any
from uuid import uuid4


class PowerUnit(Enum):
    AMPERE = "A"
    KILOWATT = "kW"
    WATT = "W"


class RecordStatus(Enum):
    VALID = "valid"
    QUARANTINED = "quarantined"
    DUPLICATE = "duplicate"


class RiskType(Enum):
    OVERLOAD = "overload"
    SUSTAINED_OVERLOAD = "sustained_overload"
    PHASE_IMBALANCE = "phase_imbalance"
    UNPLANNED_POWER = "unplanned_power"
    TIME_DEVIATION = "time_deviation"
    MISSING_FIELD = "missing_field"
    INVALID_TIME = "invalid_time"
    INVALID_CIRCUIT = "invalid_circuit"
    INVALID_UNIT = "invalid_unit"
    DUPLICATE_RECORD = "duplicate_record"


class RiskSeverity(Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class ReviewStatus(Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    IGNORED = "ignored"


@dataclass
class LogRecord:
    id: str
    timestamp: datetime
    circuit_id: str
    current: float
    unit: PowerUnit
    phase: Optional[str] = None
    voltage: Optional[float] = None
    power_factor: Optional[float] = None
    raw_data: Dict[str, Any] = field(default_factory=dict)
    status: RecordStatus = RecordStatus.VALID
    quarantine_reason: Optional[str] = None

    def __post_init__(self):
        if not self.id:
            self.id = str(uuid4())


@dataclass
class PlanRecord:
    id: str
    circuit_id: str
    device_name: str
    device_id: str
    power_on_time: Optional[datetime] = None
    power_off_time: Optional[datetime] = None
    expected_current: Optional[float] = None
    unit: Optional[PowerUnit] = None
    raw_data: Dict[str, Any] = field(default_factory=dict)
    status: RecordStatus = RecordStatus.VALID
    quarantine_reason: Optional[str] = None

    def __post_init__(self):
        if not self.id:
            self.id = str(uuid4())


@dataclass
class Risk:
    id: str
    risk_type: RiskType
    severity: RiskSeverity
    message: str
    timestamp: datetime
    circuit_id: Optional[str] = None
    device_id: Optional[str] = None
    device_name: Optional[str] = None
    related_record_ids: List[str] = field(default_factory=list)
    details: Dict[str, Any] = field(default_factory=dict)
    review_status: ReviewStatus = ReviewStatus.PENDING
    review_note: Optional[str] = None

    def __post_init__(self):
        if not self.id:
            self.id = str(uuid4())


@dataclass
class AnalysisResult:
    id: str
    generated_at: datetime
    time_window_minutes: int
    
    peak_loads: Dict[str, float] = field(default_factory=dict)
    sustained_overloads: List[Risk] = field(default_factory=list)
    phase_imbalances: List[Risk] = field(default_factory=list)
    unplanned_powers: List[Risk] = field(default_factory=list)
    time_deviations: List[Risk] = field(default_factory=list)
    
    all_risks: List[Risk] = field(default_factory=list)
    summary: Dict[str, Any] = field(default_factory=dict)

    def __post_init__(self):
        if not self.id:
            self.id = str(uuid4())
        self._aggregate_risks()

    def _aggregate_risks(self):
        self.all_risks = (
            self.sustained_overloads
            + self.phase_imbalances
            + self.unplanned_powers
            + self.time_deviations
        )
        self.summary = {
            "total_risks": len(self.all_risks),
            "by_severity": {
                "critical": sum(1 for r in self.all_risks if r.severity == RiskSeverity.CRITICAL),
                "high": sum(1 for r in self.all_risks if r.severity == RiskSeverity.HIGH),
                "medium": sum(1 for r in self.all_risks if r.severity == RiskSeverity.MEDIUM),
                "low": sum(1 for r in self.all_risks if r.severity == RiskSeverity.LOW),
            },
            "by_type": {
                "sustained_overload": len(self.sustained_overloads),
                "phase_imbalance": len(self.phase_imbalances),
                "unplanned_power": len(self.unplanned_powers),
                "time_deviation": len(self.time_deviations),
            },
        }


@dataclass
class DataStore:
    log_records: List[LogRecord] = field(default_factory=list)
    plan_records: List[PlanRecord] = field(default_factory=list)
    quarantined_logs: List[LogRecord] = field(default_factory=list)
    quarantined_plans: List[PlanRecord] = field(default_factory=list)
    analysis_results: List[AnalysisResult] = field(default_factory=list)

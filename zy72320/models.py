from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import List, Optional, Dict, Any


class RecordStatus(Enum):
    NORMAL = "normal"
    GAP_DETECTED = "gap_detected"
    OLD_CALIBER = "old_caliber"
    PENDING_REVIEW = "pending_review"
    CONFIRMED = "confirmed"
    REJECTED = "rejected"


class RecordSource(Enum):
    IMPORT = "import"
    MANUAL_FILL = "manual_fill"
    HAND_CALCULATION = "hand_calculation"


@dataclass
class PredictionRecord:
    record_id: int
    date: str
    store_id: str
    predicted_foot_traffic: float
    poisson_lambda: float
    status: RecordStatus
    source: RecordSource
    created_at: datetime = field(default_factory=datetime.now)
    version: str = "v1.0"
    notes: Optional[str] = None
    previous_version: Optional[str] = None


@dataclass
class ParameterVersion:
    version: str
    lambda_value: float
    effective_date: str
    created_by: str
    created_at: datetime = field(default_factory=datetime.now)
    reason: str = ""
    is_active: bool = True


@dataclass
class HandCalculation:
    calc_id: str
    date: str
    store_id: str
    manual_value: float
    formula_used: str
    created_by: str
    created_at: datetime = field(default_factory=datetime.now)
    is_confirmed: bool = False


@dataclass
class ConflictEvidence:
    conflict_id: str
    record_id: int
    parameter_value: float
    hand_calc_value: float
    description: str
    created_at: datetime = field(default_factory=datetime.now)
    resolution: Optional[str] = None


@dataclass
class ProcessingLog:
    log_id: str
    record_id: int
    action: str
    operator: str
    timestamp: datetime = field(default_factory=datetime.now)
    details: Dict[str, Any] = field(default_factory=dict)

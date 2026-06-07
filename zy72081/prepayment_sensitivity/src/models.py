from dataclasses import dataclass, field, asdict
from typing import Dict, List, Optional, Any
from datetime import datetime
import json
import hashlib


@dataclass
class Parameter:
    name: str
    value: float
    weight: float
    description: str
    source: str = "default"
    last_modified: str = field(default_factory=lambda: datetime.now().isoformat())
    modified_by: str = "system"


@dataclass
class ParameterVersion:
    version_id: str
    parameters: Dict[str, Parameter]
    created_at: str
    created_by: str
    note: str = ""
    is_active: bool = True

    def to_dict(self) -> Dict:
        return {
            "version_id": self.version_id,
            "parameters": {k: asdict(v) for k, v in self.parameters.items()},
            "created_at": self.created_at,
            "created_by": self.created_by,
            "note": self.note,
            "is_active": self.is_active,
        }


@dataclass
class LoanSample:
    sample_id: str
    loan_id: str
    principal: float
    interest_rate: float
    remaining_term: int
    borrower_age: int
    fico_score: int
    dti_ratio: float
    ltv_ratio: float
    has_prepayment_history: bool
    source: str
    raw_data: Dict[str, Any]

    def to_dict(self) -> Dict:
        return asdict(self)


@dataclass
class AnomalyFlag:
    sample_id: str
    field_name: str
    expected_range: str
    actual_value: Any
    severity: str
    description: str

    def to_dict(self) -> Dict:
        return asdict(self)


@dataclass
class CalculationStep:
    step_name: str
    input_values: Dict[str, Any]
    formula: str
    result: float
    parameter_used: Dict[str, float]

    def to_dict(self) -> Dict:
        return asdict(self)


@dataclass
class SensitivityResult:
    sample_id: str
    loan_id: str
    sensitivity_score: float
    risk_level: str
    calculation_steps: List[CalculationStep]
    parameters_used: Dict[str, float]
    parameter_version_id: str
    anomalies: List[AnomalyFlag]
    needs_manual_review: bool
    review_status: str = "pending"
    review_note: str = ""
    reviewed_by: str = ""
    reviewed_at: str = ""
    calculated_at: str = field(default_factory=lambda: datetime.now().isoformat())

    def to_dict(self) -> Dict:
        return {
            "sample_id": self.sample_id,
            "loan_id": self.loan_id,
            "sensitivity_score": self.sensitivity_score,
            "risk_level": self.risk_level,
            "calculation_steps": [s.to_dict() for s in self.calculation_steps],
            "parameters_used": self.parameters_used,
            "parameter_version_id": self.parameter_version_id,
            "anomalies": [a.to_dict() for a in self.anomalies],
            "needs_manual_review": self.needs_manual_review,
            "review_status": self.review_status,
            "review_note": self.review_note,
            "reviewed_by": self.reviewed_by,
            "reviewed_at": self.reviewed_at,
            "calculated_at": self.calculated_at,
        }


@dataclass
class ReviewChartData:
    record_id: str
    loan_id: str
    reported_sensitivity: float
    reported_risk: str
    report_period: str
    data_source: str
    manual_note: str = ""

    def to_dict(self) -> Dict:
        return asdict(self)


@dataclass
class DataConflict:
    conflict_id: str
    loan_id: str
    sample_value: Any
    chart_value: Any
    field_name: str
    sample_source: str
    chart_source: str
    difference: float
    suggested_action: str
    resolved: bool = False
    resolution_note: str = ""

    def to_dict(self) -> Dict:
        return asdict(self)


@dataclass
class RunHistory:
    run_id: str
    timestamp: str
    parameter_version_id: str
    sample_count: int
    anomaly_count: int
    conflict_count: int
    manual_review_count: int
    results: List[SensitivityResult]
    conflicts: List[DataConflict]
    status: str = "completed"

    def to_dict(self) -> Dict:
        return {
            "run_id": self.run_id,
            "timestamp": self.timestamp,
            "parameter_version_id": self.parameter_version_id,
            "sample_count": self.sample_count,
            "anomaly_count": self.anomaly_count,
            "conflict_count": self.conflict_count,
            "manual_review_count": self.manual_review_count,
            "results": [r.to_dict() for r in self.results],
            "conflicts": [c.to_dict() for c in self.conflicts],
            "status": self.status,
        }


def generate_id(prefix: str, content: str = "") -> str:
    now = datetime.now()
    timestamp = now.strftime("%Y%m%d%H%M%S")
    millis = int(now.timestamp() * 1000) % 1000
    if content:
        hash_suffix = hashlib.md5(content.encode()).hexdigest()[:8]
        return f"{prefix}_{timestamp}{millis:03d}_{hash_suffix}"
    return f"{prefix}_{timestamp}{millis:03d}"

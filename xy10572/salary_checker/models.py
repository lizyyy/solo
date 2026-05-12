from dataclasses import dataclass, field, asdict
from typing import List, Dict, Optional, Any
from datetime import datetime
import json


def _default_datetime():
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


@dataclass
class Employee:
    emp_id: str
    name: str
    employee_type: str
    department: str
    bank_account: str
    bank_name: str


@dataclass
class SalaryItem:
    emp_id: str
    month: str
    base_salary: float
    overtime: float = 0.0
    performance: float = 0.0
    other_allowance: float = 0.0


@dataclass
class Attendance:
    emp_id: str
    month: str
    work_days: int
    absent_days: int
    late_times: int


@dataclass
class Leave:
    leave_id: str
    emp_id: str
    leave_type: str
    start_date: str
    end_date: str
    days: float
    is_approved: bool = True


@dataclass
class Allowance:
    allowance_id: str
    emp_id: str
    month: str
    allowance_type: str
    amount: float
    approved_by: Optional[str] = None


@dataclass
class Deduction:
    deduction_id: str
    emp_id: str
    month: str
    deduction_type: str
    amount: float
    reason: str
    approved_by: Optional[str] = None


@dataclass
class Tax:
    emp_id: str
    month: str
    tax_amount: float
    taxable_income: float
    cumulative_tax: float


@dataclass
class BankResponse:
    response_id: str
    emp_id: str
    month: str
    status: str
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    retry_count: int = 0
    last_attempt: Optional[str] = None


@dataclass
class Anomaly:
    anomaly_id: str
    emp_id: str
    month: str
    rule_code: str
    rule_name: str
    severity: str
    status: str
    message: str
    detail: Dict[str, Any]
    created_at: str = field(default_factory=_default_datetime)
    resolved_at: Optional[str] = None
    resolved_by: Optional[str] = None
    resolution_detail: Optional[Dict[str, Any]] = None


@dataclass
class Correction:
    correction_id: str
    emp_id: str
    month: str
    operator: str
    operation: str
    before_value: Any
    after_value: Any
    reason: str
    created_at: str = field(default_factory=_default_datetime)


@dataclass
class ImportRecord:
    record_id: str
    data_type: str
    month: str
    file_path: str
    count: int
    status: str
    error_message: Optional[str] = None
    created_at: str = field(default_factory=_default_datetime)


@dataclass
class CheckRun:
    run_id: str
    month: str
    status: str
    total_anomalies: int = 0
    blocker_anomalies: int = 0
    warning_anomalies: int = 0
    resolved_anomalies: int = 0
    started_at: str = field(default_factory=_default_datetime)
    finished_at: Optional[str] = None


def to_dict(obj):
    return asdict(obj)


def from_dict(data: Dict, cls):
    return cls(**data)

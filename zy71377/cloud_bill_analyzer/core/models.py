from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional, Any
from datetime import datetime


class CloudProvider(str, Enum):
    AWS = "aws"
    ALIYUN = "aliyun"
    VOLCENGINE = "volcengine"
    UNKNOWN = "unknown"


class AnomalyType(str, Enum):
    COST_SPIKE = "cost_spike"
    COST_DROP = "cost_drop"
    MISSING_TAG = "missing_tag"
    INVALID_TAG = "invalid_tag"
    DUPLICATE_RI_CREDIT = "duplicate_ri_credit"
    CURRENCY_ERROR = "currency_error"
    BUDGET_EXCEEDED = "budget_exceeded"
    MISSING_REQUIRED_FIELD = "missing_required_field"


class TagIssueType(str, Enum):
    MISSING = "missing"
    INVALID_FORMAT = "invalid_format"
    EMPTY = "empty"
    INVALID_VALUE = "invalid_value"


CURRENCY_MAP: Dict[str, str] = {
    "USD": "USD",
    "CNY": "CNY",
    "RMB": "CNY",
    "¥": "CNY",
    "$": "USD",
}


REQUIRED_FIELDS: List[str] = [
    "resource_id",
    "billing_period_start",
    "billing_period_end",
    "cost",
    "currency",
    "service",
]


@dataclass
class TagIssue:
    field_name: str
    issue_type: TagIssueType
    original_value: Optional[str] = None
    message: str = ""


@dataclass
class BillRecord:
    provider: CloudProvider
    raw_data: Dict[str, Any]
    source_file: str
    line_number: Optional[int] = None
    tag_issues: List[TagIssue] = field(default_factory=list)
    has_ri_credit: bool = False


@dataclass
class NormalizedBill:
    provider: CloudProvider
    resource_id: str
    billing_period_start: datetime
    billing_period_end: datetime
    cost: float
    original_currency: str
    normalized_currency: str
    exchange_rate: float
    normalized_cost: float
    service: str
    region: Optional[str] = None
    instance_type: Optional[str] = None
    tags: Dict[str, str] = field(default_factory=dict)
    project: Optional[str] = None
    team: Optional[str] = None
    environment: Optional[str] = None
    is_ri_credit: bool = False
    ri_arn: Optional[str] = None
    original_record: Optional[BillRecord] = None
    issues: List[TagIssue] = field(default_factory=list)
    missing_fields: List[str] = field(default_factory=list)


@dataclass
class AnomalyRecord:
    anomaly_type: AnomalyType
    severity: str
    message: str
    provider: Optional[CloudProvider] = None
    resource_id: Optional[str] = None
    service: Optional[str] = None
    project: Optional[str] = None
    period: Optional[str] = None
    current_cost: Optional[float] = None
    previous_cost: Optional[float] = None
    change_percent: Optional[float] = None
    threshold: Optional[float] = None
    normalized_bill: Optional[NormalizedBill] = None
    raw_data: Dict[str, Any] = field(default_factory=dict)


@dataclass
class BudgetLine:
    project: str
    monthly_budget: float
    currency: str
    service: Optional[str] = None
    team: Optional[str] = None


@dataclass
class AnalysisResult:
    normalized_bills: List[NormalizedBill]
    anomalies: List[AnomalyRecord]
    tag_issues_count: Dict[str, int]
    duplicate_ri_credits: List[NormalizedBill]
    currency_errors: List[AnomalyRecord]
    missing_fields_count: int
    total_normalized_cost: float
    budget_comparison: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    summary: Dict[str, Any] = field(default_factory=dict)

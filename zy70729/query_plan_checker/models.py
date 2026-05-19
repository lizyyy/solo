from enum import Enum
from typing import List, Dict, Optional, Any
from dataclasses import dataclass, field
from datetime import datetime


class RiskLevel(str, Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"
    NONE = "NONE"


class ConfirmStatus(str, Enum):
    PENDING = "PENDING"
    CONFIRMED = "CONFIRMED"
    REJECTED = "REJECTED"
    NEED_REVIEW = "NEED_REVIEW"


class RegressionConclusion(str, Enum):
    REGRESSED = "REGRESSED"
    NOT_REGRESSED = "NOT_REGRESSED"
    NEED_INVESTIGATION = "NEED_INVESTIGATION"
    FALSE_POSITIVE = "FALSE_POSITIVE"


@dataclass
class SourceLocation:
    file_path: str
    line_number: int
    column: Optional[int] = None
    raw_content: str = ""


@dataclass
class PlanSummary:
    scan_type: str
    join_type: str
    estimated_rows: int
    estimated_cost: float
    used_indexes: List[str] = field(default_factory=list)
    extra_info: Dict[str, Any] = field(default_factory=dict)


@dataclass
class QueryPlan:
    query_template: str
    parameter_set: Dict[str, Any]
    plan_json: Dict[str, Any]
    summary: PlanSummary
    source_location: Optional[SourceLocation] = None
    db_version: str = ""
    generated_at: Optional[datetime] = None


@dataclass
class PlanComparison:
    query_template: str
    parameter_set_normalized: str
    old_plan: QueryPlan
    new_plan: QueryPlan
    differences: Dict[str, Any] = field(default_factory=dict)
    risk_level: RiskLevel = RiskLevel.NONE
    confirm_status: ConfirmStatus = ConfirmStatus.PENDING
    conclusion: RegressionConclusion = RegressionConclusion.NEED_INVESTIGATION
    notes: str = ""
    review_by: str = ""
    review_at: Optional[datetime] = None


@dataclass
class ParseError:
    source_location: SourceLocation
    error_message: str
    error_type: str


@dataclass
class CheckResult:
    comparisons: List[PlanComparison] = field(default_factory=list)
    parse_errors: List[ParseError] = field(default_factory=list)
    summary: Dict[str, Any] = field(default_factory=dict)
    generated_at: datetime = field(default_factory=datetime.now)

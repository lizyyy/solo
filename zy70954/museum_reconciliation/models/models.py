from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import List, Optional
from uuid import uuid4


class ArtifactGrade(Enum):
    FIRST_CLASS = "一级文物"
    SECOND_CLASS = "二级文物"
    THIRD_CLASS = "三级文物"
    GENERAL = "一般文物"


class DiscrepancyType(Enum):
    VALUATION_CHANGE = "估值变更"
    TRANSPORT_DELAY = "运输延误"
    HUMIDITY_ABNORMAL = "温湿度异常"
    TEMPERATURE_ABNORMAL = "温度异常"
    INSURANCE_MISMATCH = "保险金额不符"
    TRANSPORT_NODE_MISSING = "运输节点缺失"
    CONDITION_CHANGE = "文物状态变化"


class ReviewStatus(Enum):
    PENDING = "待复核"
    APPROVED = "已放行"
    REJECTED = "已退回"
    NEEDS_SUPPLEMENT = "需补材料"


class ReconciliationStatus(Enum):
    MATCHED = "完全一致"
    NEEDS_REVIEW = "待复核"
    RESOLVED = "已处理"
    EXCEPTION = "异常"


@dataclass
class Artifact:
    artifact_id: str
    name: str
    grade: ArtifactGrade
    category: str
    origin_museum: str
    current_valuation: float
    previous_valuation: Optional[float] = None
    condition: str = "完好"
    last_condition_check: Optional[str] = None
    remarks: str = ""
    import_batch: str = ""


@dataclass
class TransportNode:
    node_name: str
    planned_arrival: str
    actual_arrival: Optional[str] = None
    temperature: Optional[float] = None
    humidity: Optional[float] = None
    status: str = "正常"
    notes: str = ""


@dataclass
class TransportRecord:
    transport_id: str
    artifact_id: str
    start_location: str
    end_location: str
    planned_start_date: str
    planned_end_date: str
    actual_start_date: Optional[str] = None
    actual_end_date: Optional[str] = None
    transport_method: str = ""
    carrier: str = ""
    nodes: List[TransportNode] = field(default_factory=list)
    overall_status: str = "正常"
    import_batch: str = ""


@dataclass
class InsurancePolicy:
    policy_id: str
    artifact_id: str
    insurer: str
    insured_amount: float
    coverage_start: str
    coverage_end: str
    policy_type: str = "一切险"
    premium: Optional[float] = None
    exclusions: str = ""
    special_clauses: str = ""
    import_batch: str = ""


@dataclass
class Discrepancy:
    discrepancy_id: str = field(default_factory=lambda: str(uuid4()))
    artifact_id: str = ""
    discrepancy_type: DiscrepancyType = DiscrepancyType.VALUATION_CHANGE
    field_name: str = ""
    expected_value: str = ""
    actual_value: str = ""
    description: str = ""
    explanation: str = ""
    severity: str = "normal"
    created_at: str = field(default_factory=lambda: datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    resolved: bool = False
    resolution_note: str = ""


@dataclass
class ReviewDecision:
    review_id: str = field(default_factory=lambda: str(uuid4()))
    artifact_id: str = ""
    decision: ReviewStatus = ReviewStatus.PENDING
    reviewer: str = ""
    review_time: Optional[str] = None
    comments: str = ""
    required_actions: str = ""
    requires_manual_fix: bool = False
    manual_fix_fields: List[str] = field(default_factory=list)


@dataclass
class ReconciliationRecord:
    record_id: str = field(default_factory=lambda: str(uuid4()))
    artifact_id: str = ""
    artifact_name: str = ""
    artifact_grade: Optional[ArtifactGrade] = None
    transport: Optional[TransportRecord] = None
    insurance: Optional[InsurancePolicy] = None
    artifact: Optional[Artifact] = None
    discrepancies: List[Discrepancy] = field(default_factory=list)
    review_decision: Optional[ReviewDecision] = None
    status: ReconciliationStatus = ReconciliationStatus.NEEDS_REVIEW
    matched_fields: List[str] = field(default_factory=list)
    unmatched_fields: List[str] = field(default_factory=list)
    created_at: str = field(default_factory=lambda: datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    updated_at: str = field(default_factory=lambda: datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    reconciliation_batch: str = ""

    @property
    def has_discrepancies(self) -> bool:
        return len(self.discrepancies) > 0

    @property
    def needs_manual_review(self) -> bool:
        return self.status == ReconciliationStatus.NEEDS_REVIEW

    @property
    def is_resolved(self) -> bool:
        return self.status == ReconciliationStatus.RESOLVED
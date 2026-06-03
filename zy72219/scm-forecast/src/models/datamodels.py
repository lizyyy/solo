from dataclasses import dataclass, field
from datetime import datetime, date
from typing import Optional, List, Dict, Any
from enum import Enum


class MaterialType(str, Enum):
    NORMAL = "normal"
    WRONG_DIMENSION = "wrong_dimension"
    SUPPLEMENTARY = "supplementary"


class SettlementCycle(str, Enum):
    T1 = "T+1"
    T2 = "T+2"


class ModificationStatus(str, Enum):
    PENDING_REVIEW = "pending_review"
    CONFIRMED = "confirmed"
    REJECTED = "rejected"
    NORMAL = "normal"


class WorkflowStepStatus(str, Enum):
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    NEEDS_REVIEW = "needs_review"


@dataclass
class SettlementBatch:
    batch_id: str
    batch_date: date
    import_timestamp: datetime
    total_amount: float
    record_count: int
    source_file: str
    is_duplicate: bool = False
    duplicate_of_batch: Optional[str] = None
    import_user: str = "system"
    workflow_step: str = "import_settlement_batch"
    step_status: WorkflowStepStatus = WorkflowStepStatus.NOT_STARTED

    def __hash__(self):
        return hash((self.batch_id, self.batch_date.isoformat()))


@dataclass
class ForecastRecord:
    record_id: str
    batch_id: str
    supplier_id: str
    supplier_name: str
    invoice_amount: float
    original_settlement_cycle: SettlementCycle
    current_settlement_cycle: SettlementCycle
    expected_arrival_date: date
    original_arrival_date: date
    is_manually_modified: bool = False
    modification_reason: Optional[str] = None
    modified_by: Optional[str] = None
    modification_timestamp: Optional[datetime] = None
    modification_status: ModificationStatus = ModificationStatus.NORMAL
    review_note: Optional[str] = None
    holiday_deferral_applies: bool = False
    holiday_deferral_explanation: Optional[str] = None


@dataclass
class ChangeHistory:
    history_id: str
    record_id: str
    field_changed: str
    old_value: Any
    new_value: Any
    changed_by: str
    change_timestamp: datetime
    change_reason: str
    batch_id: Optional[str] = None


@dataclass
class ReconciliationNote:
    note_id: str
    batch_id: str
    record_id: str
    note_content: str
    note_type: str
    created_by: str
    created_timestamp: datetime
    updated_by: Optional[str] = None
    updated_timestamp: Optional[datetime] = None
    is_reconciled: bool = False
    reconciled_by: Optional[str] = None
    reconciled_timestamp: Optional[datetime] = None


@dataclass
class ConflictEvidence:
    conflict_id: str
    batch_id: str
    record_id: str
    conflict_type: str
    evidence_description: str
    field_a_name: str
    field_a_value: Any
    field_b_name: str
    field_b_value: Any
    resolution_status: str = "pending"
    resolved_by: Optional[str] = None
    resolved_timestamp: Optional[datetime] = None
    resolution: Optional[str] = None
    requires_manager_review: bool = True


@dataclass
class WorkflowState:
    batch_id: str
    current_step: int = 0
    step_statuses: Dict[str, WorkflowStepStatus] = field(default_factory=dict)
    step_timestamps: Dict[str, datetime] = field(default_factory=dict)
    step_operators: Dict[str, str] = field(default_factory=dict)
    conflicts_found: List[str] = field(default_factory=list)
    modifications_found: List[str] = field(default_factory=list)
    t1_to_t2_records: List[str] = field(default_factory=list)
    is_complete: bool = False
    final_report_ready: bool = False
    requires_manager_review: bool = False

    def __post_init__(self):
        from config.settings import WORKFLOW_STEPS
        for step in WORKFLOW_STEPS:
            if step not in self.step_statuses:
                self.step_statuses[step] = WorkflowStepStatus.NOT_STARTED


@dataclass
class ForecastDataset:
    material_type: MaterialType
    batch: SettlementBatch
    records: List[ForecastRecord] = field(default_factory=list)
    change_history: List[ChangeHistory] = field(default_factory=list)
    reconciliation_notes: List[ReconciliationNote] = field(default_factory=list)
    conflicts: List[ConflictEvidence] = field(default_factory=list)
    workflow_state: Optional[WorkflowState] = None
    checks_passed: Dict[str, bool] = field(default_factory=dict)
    checks_detail: Dict[str, Any] = field(default_factory=dict)

    def get_record_by_id(self, record_id: str) -> Optional[ForecastRecord]:
        for r in self.records:
            if r.record_id == record_id:
                return r
        return None

    def get_change_history_for_record(self, record_id: str) -> List[ChangeHistory]:
        return [h for h in self.change_history if h.record_id == record_id]

    def get_notes_for_record(self, record_id: str) -> List[ReconciliationNote]:
        return [n for n in self.reconciliation_notes if n.record_id == record_id]


@dataclass
class SelfCheckResult:
    check_name: str
    passed: bool
    severity: str
    message: str
    details: Dict[str, Any] = field(default_factory=dict)
    evidence: List[str] = field(default_factory=list)
    recommendation: Optional[str] = None


@dataclass
class SelfCheckReport:
    batch_id: str
    check_timestamp: datetime
    overall_pass: bool
    results: List[SelfCheckResult] = field(default_factory=list)

    def get_result(self, check_name: str) -> Optional[SelfCheckResult]:
        for r in self.results:
            if r.check_name == check_name:
                return r
        return None

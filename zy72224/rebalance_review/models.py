import uuid
from datetime import datetime
from enum import Enum
from dataclasses import dataclass, field
from typing import Optional


class ReviewStatus(Enum):
    PENDING = "pending"
    PINYIN_FLAGGED = "pinyin_flagged"
    APPROVED = "approved"
    REJECTED = "rejected"
    ROLLED_BACK = "rolled_back"
    AWAITING_CLIENT_MANAGER_REVIEW = "awaiting_client_manager_review"


class WorkflowPhase(Enum):
    TAX_RATE_IMPORT = "tax_rate_import"
    COUNTER_TRANSACTION_CHECK = "counter_transaction_check"
    BALANCE_UPDATE = "balance_update"
    COMPLETED = "completed"


class PinyinVerdict(Enum):
    NORMAL = "normal"
    PINYIN_ONLY = "pinyin_only"
    AMBIGUOUS = "ambiguous"


@dataclass
class TaxRateNote:
    id: str = field(default_factory=lambda: uuid.uuid4().hex[:12])
    batch_id: str = ""
    tax_category: str = ""
    rate: float = 0.0
    remark: str = ""
    approver_name: str = ""
    source_file: str = ""
    imported_at: datetime = field(default_factory=datetime.now)

    def fingerprint(self) -> str:
        return f"{self.tax_category}:{self.rate}:{self.remark}:{self.approver_name}"


@dataclass
class CounterTransaction:
    id: str = field(default_factory=lambda: uuid.uuid4().hex[:12])
    tail_number: str = ""
    amount: float = 0.0
    transaction_date: str = ""
    description: str = ""
    linked_tax_note_id: Optional[str] = None


@dataclass
class BalanceChangeEntry:
    id: str = field(default_factory=lambda: uuid.uuid4().hex[:12])
    account: str = ""
    before_balance: float = 0.0
    after_balance: float = 0.0
    change_reason: str = ""
    linked_counter_tx_id: Optional[str] = None
    updated_at: datetime = field(default_factory=datetime.now)


@dataclass
class ApproverBoundaryRule:
    id: str = field(default_factory=lambda: uuid.uuid4().hex[:12])
    rule_name: str = ""
    description: str = ""
    condition_type: str = ""
    condition_value: str = ""
    action: str = ""
    priority: int = 0
    is_active: bool = True


@dataclass
class ChangeHistory:
    id: str = field(default_factory=lambda: uuid.uuid4().hex[:12])
    record_id: str = ""
    field_name: str = ""
    old_value: str = ""
    new_value: str = ""
    changed_by: str = ""
    changed_at: datetime = field(default_factory=datetime.now)
    change_type: str = ""

    def diff_summary(self) -> str:
        return f"[{self.field_name}] '{self.old_value}' -> '{self.new_value}' (by {self.changed_by})"


@dataclass
class ReviewRecord:
    id: str = field(default_factory=lambda: uuid.uuid4().hex[:12])
    portfolio_name: str = ""
    approver_name: str = ""
    approver_pinyin_verdict: PinyinVerdict = PinyinVerdict.NORMAL
    status: ReviewStatus = ReviewStatus.PENDING
    workflow_phase: WorkflowPhase = WorkflowPhase.TAX_RATE_IMPORT
    tax_notes: list = field(default_factory=list)
    counter_transactions: list = field(default_factory=list)
    balance_entries: list = field(default_factory=list)
    history: list = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)

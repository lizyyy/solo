from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, Dict, List
from enum import Enum


class TransactionType(Enum):
    PAYMENT = "payment"
    REFUND = "refund"


class MatchStatus(Enum):
    MATCHED = "matched"
    UNMATCHED = "unmatched"
    DUPLICATE = "duplicate"
    BAD_ROW = "bad_row"


class DiscrepancyReason(Enum):
    TIME_WINDOW_MISMATCH = "time_window_mismatch"
    AMOUNT_MISMATCH = "amount_mismatch"
    REFUND_NOT_FOUND = "refund_not_found"
    DUPLICATE_TRANSACTION = "duplicate_transaction"
    MISSING_IN_CASH_REGISTER = "missing_in_cash_register"
    MISSING_IN_PAYMENT_GATEWAY = "missing_in_payment_gateway"
    STORE_MISMATCH = "store_mismatch"
    UNKNOWN = "unknown"


@dataclass
class SourceLocation:
    file_path: str
    line_number: int
    raw_content: str


@dataclass
class Transaction:
    transaction_id: str
    store_id: str
    amount: float
    transaction_time: datetime
    transaction_type: TransactionType
    source: SourceLocation
    payment_method: Optional[str] = None
    order_no: Optional[str] = None
    is_refund_marked: bool = False
    refund_reference: Optional[str] = None
    extra: Dict = field(default_factory=dict)

    def __hash__(self):
        return hash((self.transaction_id, self.store_id, self.amount, self.transaction_time))


@dataclass
class MatchResult:
    cash_register_tx: Optional[Transaction]
    payment_gateway_tx: Optional[Transaction]
    status: MatchStatus
    discrepancy_reason: Optional[DiscrepancyReason] = None
    match_confidence: float = 0.0
    notes: Optional[str] = None


@dataclass
class ReconciliationSummary:
    total_cash_register: int
    total_payment_gateway: int
    matched_count: int
    unmatched_count: int
    duplicate_count: int
    bad_row_count: int
    discrepancy_breakdown: Dict[DiscrepancyReason, int]
    processing_time: float


@dataclass
class ReconciliationResult:
    matches: List[MatchResult]
    summary: ReconciliationSummary
    bad_rows: List[SourceLocation]
    generated_at: datetime

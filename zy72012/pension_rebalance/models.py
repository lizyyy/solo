from dataclasses import dataclass, field
from typing import Optional


@dataclass
class Receipt:
    transaction_id: str
    fund_code: str
    amount: Optional[float]
    date: str
    counterparty: str
    status: str
    source_file: str = ""
    loaded_at: str = ""
    raw_amount: str = ""
    raw_fund_code: str = ""
    raw_date: str = ""


@dataclass
class Refund:
    refund_id: str
    transaction_id: str
    fund_code: str
    amount: Optional[float]
    reason: str
    apply_date: str
    status: str
    source_file: str = ""
    loaded_at: str = ""
    raw_amount: str = ""
    raw_transaction_id: str = ""


@dataclass
class Approval:
    approval_id: str
    refund_id: str
    approver: str
    approve_date: str
    result: str
    attachment_ref: str = ""
    source_file: str = ""
    loaded_at: str = ""


@dataclass
class Note:
    note_id: str
    transaction_id: str
    content: str
    author: str
    note_date: str
    source: str = ""
    source_file: str = ""
    loaded_at: str = ""


@dataclass
class ChangeEntry:
    field_name: str
    old_value: str
    new_value: str
    changed_at: str
    changed_by: str
    reason: str


@dataclass
class ReconcileResult:
    transaction_id: str
    fund_code: str = ""
    receipt_amount: Optional[float] = None
    refund_amount: Optional[float] = None
    amount_match: Optional[str] = None
    has_refund: bool = False
    refund_status: str = ""
    has_approval: bool = False
    approval_result: str = ""
    notes: str = ""
    warnings: list = field(default_factory=list)
    change_chain: list = field(default_factory=list)
    source_file: str = ""
    processed_at: str = ""
    judgment: str = ""
    judgment_reason: str = ""

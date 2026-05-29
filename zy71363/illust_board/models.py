from datetime import datetime
from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field


class CommissionStatus(str, Enum):
    DRAFT = "draft"
    SKETCH = "sketch"
    IN_PROGRESS = "in_progress"
    WAITING_CONFIRM = "waiting_confirm"
    REVISING = "revising"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class PaymentStatus(str, Enum):
    UNPAID = "unpaid"
    DEPOSIT_PAID = "deposit_paid"
    FULL_PAID = "full_paid"


class RevisionRecord(BaseModel):
    version: int
    feedback: str
    date: datetime
    replied_at: Optional[datetime] = None
    is_resolved: bool = False
    resolved_at: Optional[datetime] = None


class SketchVersion(BaseModel):
    version: int
    file_path: str
    created_at: datetime
    description: str = ""
    revisions: List[RevisionRecord] = []


class PaymentNode(BaseModel):
    node_type: str
    amount: float
    due_date: Optional[datetime]
    paid: bool = False
    paid_at: Optional[datetime] = None
    transaction_id: Optional[str] = None


class ConfirmationRecord(BaseModel):
    stage: str
    confirmed: bool = False
    confirmed_at: Optional[datetime] = None
    screenshot_path: Optional[str] = None
    notes: str = ""


class Commission(BaseModel):
    id: str
    title: str
    client_name: str
    created_at: datetime
    description: str = ""
    status: CommissionStatus = CommissionStatus.DRAFT
    max_revisions: int = 3
    sketches: List[SketchVersion] = []
    payments: List[PaymentNode] = []
    confirmations: List[ConfirmationRecord] = []
    tags: List[str] = []
    notes: str = ""

    @property
    def current_sketch_version(self) -> Optional[SketchVersion]:
        return self.sketches[-1] if self.sketches else None

    @property
    def total_revisions(self) -> int:
        return sum(len(s.revisions) for s in self.sketches)

    @property
    def is_over_revision_limit(self) -> bool:
        return self.total_revisions > self.max_revisions

    @property
    def has_final_paid(self) -> bool:
        return any(p.node_type == "final" and p.paid for p in self.payments)

    @property
    def has_missing_screenshots(self) -> List[str]:
        missing = []
        for conf in self.confirmations:
            if conf.confirmed and not conf.screenshot_path:
                missing.append(conf.stage)
        return missing

    @property
    def payment_status(self) -> PaymentStatus:
        has_deposit = any(p.node_type == "deposit" and p.paid for p in self.payments)
        has_final = any(p.node_type == "final" and p.paid for p in self.payments)
        if has_final:
            return PaymentStatus.FULL_PAID
        elif has_deposit:
            return PaymentStatus.DEPOSIT_PAID
        return PaymentStatus.UNPAID

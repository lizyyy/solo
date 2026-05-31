from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, List, Dict


@dataclass
class Attachment:
    record_id: str
    attachment_type: str
    file_name: str
    received_date: str
    source: str


@dataclass
class ReviewDecision:
    record_id: str
    status: str
    reason: str
    confirmed_amount: Optional[float]
    missing_docs: List[str]
    review_notes: str
    reviewer: str
    decision_time: datetime
    budget_occupancy_note: str = ""

    STATUS_CONFIRMED = "confirmed"
    STATUS_SUSPENDED = "suspended"
    STATUS_MANUAL_REVIEW = "manual_review"

    STATUS_LABELS = {
        "confirmed": "已确认",
        "suspended": "挂起",
        "manual_review": "人工确认",
    }

    @property
    def status_label(self) -> str:
        return self.STATUS_LABELS.get(self.status, self.status)


@dataclass
class BudgetOccupancy:
    budget_code: str
    total_occupied: float
    record_ids: List[str]
    details: List[Dict] = field(default_factory=list)

    @property
    def record_count(self) -> int:
        return len(self.record_ids)

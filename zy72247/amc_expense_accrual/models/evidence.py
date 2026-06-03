import enum
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional


class EvidenceSource(enum.Enum):
    EX_RIGHTS_SCREENSHOT = "ex_rights_screenshot"
    TAX_RATE_NOTE = "tax_rate_note"


class ProcessingStatus(enum.Enum):
    PENDING_REVIEW = "pending_review"
    CONFIRMED = "confirmed"
    MODIFIED = "modified"
    ROLLED_BACK = "rolled_back"
    SPLIT_LINE_PENDING_SUPERVISOR = "split_line_pending_supervisor"


@dataclass
class ScreenshotEvidence:
    original_line_number: int
    ex_rights_date: str
    business_no: str
    amount: float
    line_type: str
    raw_text: str
    source: EvidenceSource = EvidenceSource.EX_RIGHTS_SCREENSHOT

    def to_dict(self) -> Dict[str, Any]:
        return {
            "original_line_number": self.original_line_number,
            "ex_rights_date": self.ex_rights_date,
            "business_no": self.business_no,
            "amount": self.amount,
            "line_type": self.line_type,
            "raw_text": self.raw_text,
            "source": self.source.value,
        }


@dataclass
class TaxNoteEvidence:
    tax_rate: float
    note_text: str
    business_no: str
    stated_by: str
    stated_date: str
    source: EvidenceSource = EvidenceSource.TAX_RATE_NOTE

    def to_dict(self) -> Dict[str, Any]:
        return {
            "tax_rate": self.tax_rate,
            "note_text": self.note_text,
            "business_no": self.business_no,
            "stated_by": self.stated_by,
            "stated_date": self.stated_date,
            "source": self.source.value,
        }


@dataclass
class ManualChange:
    changed_by: str
    changed_at: str
    field_name: str
    old_value: Any
    new_value: Any
    reason: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "changed_by": self.changed_by,
            "changed_at": self.changed_at,
            "field_name": self.field_name,
            "old_value": self.old_value,
            "new_value": self.new_value,
            "reason": self.reason,
        }


@dataclass
class EvidenceRecord:
    record_id: str = field(default_factory=lambda: uuid.uuid4().hex[:12])
    business_no: str = ""
    screenshot_evidence: Optional[ScreenshotEvidence] = None
    tax_note_evidence: Optional[TaxNoteEvidence] = None
    status: ProcessingStatus = ProcessingStatus.PENDING_REVIEW
    manual_changes: List[ManualChange] = field(default_factory=list)
    is_split_line: bool = False
    split_line_role: str = ""
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now().isoformat())

    def to_dict(self) -> Dict[str, Any]:
        return {
            "record_id": self.record_id,
            "business_no": self.business_no,
            "screenshot_evidence": (
                self.screenshot_evidence.to_dict() if self.screenshot_evidence else None
            ),
            "tax_note_evidence": (
                self.tax_note_evidence.to_dict() if self.tax_note_evidence else None
            ),
            "status": self.status.value,
            "manual_changes": [c.to_dict() for c in self.manual_changes],
            "is_split_line": self.is_split_line,
            "split_line_role": self.split_line_role,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }

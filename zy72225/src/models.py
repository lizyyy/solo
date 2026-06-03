from datetime import datetime
from enum import Enum
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field, field_validator


class ProcessStatus(str, Enum):
    PENDING = "pending"
    BOUNDARY_CASE = "boundary_case"
    RISK_REVIEW_REQUIRED = "risk_review_required"
    NORMAL = "normal"
    REVERSED = "reversed"
    ARCHIVED = "archived"


class BoundaryType(str, Enum):
    ZERO_AMOUNT_WITH_REVERSAL_NOTE = "zero_amount_with_reversal_note"
    NEGATIVE_AMOUNT = "negative_amount"
    MISSING_REQUIRED_FIELDS = "missing_required_fields"
    DUPLICATE_RECORD = "duplicate_record"
    TAX_RATE_MISMATCH = "tax_rate_mismatch"


class ChangeType(str, Enum):
    IMPORT = "import"
    MANUAL_EDIT = "manual_edit"
    STATUS_CHANGE = "status_change"
    BOUNDARY_RULE_APPLIED = "boundary_rule_applied"
    ROLLBACK = "rollback"


class ChangeLog(BaseModel):
    timestamp: datetime = Field(default_factory=datetime.now)
    change_type: ChangeType
    operator: str
    field_name: Optional[str] = None
    old_value: Optional[Any] = None
    new_value: Optional[Any] = None
    reason: Optional[str] = None
    batch_id: Optional[str] = None

    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}


class OriginalSnapshot(BaseModel):
    row_number: int
    source_file: str
    import_timestamp: datetime
    raw_data: Dict[str, Any]


class ReleaseRecord(BaseModel):
    record_id: str
    ex_dividend_date: str
    bill_number: str
    amount: float
    remark: str
    tax_rate: Optional[float] = None
    tax_amount: Optional[float] = None
    status: ProcessStatus = ProcessStatus.PENDING
    boundary_type: Optional[BoundaryType] = None
    boundary_note: Optional[str] = None

    original_snapshot: OriginalSnapshot
    change_history: List[ChangeLog] = Field(default_factory=list)

    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    last_editor: Optional[str] = None

    @field_validator("amount")
    @classmethod
    def amount_can_be_zero(cls, v: float) -> float:
        return v

    def add_change_log(self, change_log: ChangeLog) -> None:
        self.change_history.append(change_log)
        self.updated_at = datetime.now()
        self.last_editor = change_log.operator

    def get_change_summary(self) -> Dict[str, List[Dict[str, Any]]]:
        summary = {}
        for log in self.change_history:
            if log.field_name not in summary:
                summary[log.field_name] = []
            summary[log.field_name].append({
                "timestamp": log.timestamp.isoformat(),
                "old": log.old_value,
                "new": log.new_value,
                "operator": log.operator,
                "reason": log.reason
            })
        return summary

    def to_dict(self) -> Dict[str, Any]:
        return {
            "record_id": self.record_id,
            "ex_dividend_date": self.ex_dividend_date,
            "bill_number": self.bill_number,
            "amount": self.amount,
            "remark": self.remark,
            "tax_rate": self.tax_rate,
            "tax_amount": self.tax_amount,
            "status": self.status.value,
            "boundary_type": self.boundary_type.value if self.boundary_type else None,
            "boundary_note": self.boundary_note,
            "original_row_number": self.original_snapshot.row_number,
            "source_file": self.original_snapshot.source_file,
            "import_timestamp": self.original_snapshot.import_timestamp.isoformat(),
            "change_count": len(self.change_history),
            "last_editor": self.last_editor,
            "updated_at": self.updated_at.isoformat(),
        }

    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}

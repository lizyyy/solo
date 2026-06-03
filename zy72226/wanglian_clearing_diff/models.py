from __future__ import annotations

import enum
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class ProcessingStatus(str, enum.Enum):
    IMPORTED = "imported"
    SELF_CHECK_PASSED = "self_check_passed"
    PENDING_REVIEW = "pending_review"
    HOLIDAY_NOTED = "holiday_noted"
    SUMMARY_UPDATED = "summary_updated"
    CONFIRMED = "confirmed"
    REJECTED = "rejected"


class SelfCheckRule(str, enum.Enum):
    DUPLICATE_IMPORT = "duplicate_import"
    ZERO_AMOUNT_REVERSED = "zero_amount_reversed"
    RECALC_AFTER_SUPPLEMENT = "recalc_after_supplement"
    EXPORT_CONSISTENCY = "export_consistency"


class AuditEntry(BaseModel):
    timestamp: datetime = Field(default_factory=datetime.now)
    action: str
    actor: str = "system"
    detail: str = ""
    original_value: Optional[str] = None
    new_value: Optional[str] = None


class ClearingRecord(BaseModel):
    id: str = Field(default="", description="内部唯一 ID")
    clearing_batch_no: str = Field(description="清算批次号")
    original_line_no: int = Field(description="原始行号")
    channel: str = Field(default="", description="通道")
    amount: int = Field(description="金额（分）")
    remark: str = Field(default="", description="备注")
    status: ProcessingStatus = Field(default=ProcessingStatus.IMPORTED)
    is_duplicate: bool = Field(default=False)
    is_zero_reversed: bool = Field(default=False)
    holiday_extension_note: str = Field(default="", description="节假日顺延说明")
    supplement_applied: bool = Field(default=False, description="是否已补录")
    manual_edits: list[AuditEntry] = Field(default_factory=list, description="人工改动记录")
    audit_trail: list[AuditEntry] = Field(default_factory=list, description="完整审计轨迹")
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)

    def touch(self) -> None:
        self.updated_at = datetime.now()

    def add_audit(self, action: str, actor: str = "system", detail: str = "",
                  original_value: Optional[str] = None, new_value: Optional[str] = None) -> None:
        entry = AuditEntry(
            action=action, actor=actor, detail=detail,
            original_value=original_value, new_value=new_value,
        )
        self.audit_trail.append(entry)
        self.touch()

    def add_manual_edit(self, action: str, actor: str, detail: str = "",
                        original_value: Optional[str] = None, new_value: Optional[str] = None) -> None:
        entry = AuditEntry(
            action=action, actor=actor, detail=detail,
            original_value=original_value, new_value=new_value,
        )
        self.manual_edits.append(entry)
        self.audit_trail.append(entry)
        self.touch()


class SelfCheckResult(BaseModel):
    rule: SelfCheckRule
    passed: bool
    record_id: str = ""
    clearing_batch_no: str = ""
    message: str = ""
    severity: str = "warning"


class WorkflowStep(str, enum.Enum):
    IMPORT = "import"
    HOLIDAY_NOTE = "holiday_note"
    SUMMARY_UPDATE = "summary_update"


class HolidayExtensionInfo(BaseModel):
    clearing_batch_no: str
    note: str
    effective_date: str = ""
    source: str = ""


class SummaryUpdate(BaseModel):
    clearing_batch_no: str
    total_diff: int = 0
    total_reversed: int = 0
    pending_review_count: int = 0
    note: str = ""


class EvidenceSummary(BaseModel):
    clearing_batch_no: str
    original_line_no: int
    amount: int
    remark: str
    status: ProcessingStatus
    is_zero_reversed: bool
    holiday_extension_note: str
    audit_trail_summary: list[str] = Field(default_factory=list)

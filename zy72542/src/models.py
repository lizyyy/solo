from datetime import datetime
from typing import Optional, List
from sqlmodel import SQLModel, Field, Relationship


class QARecord(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    question: str
    answer: str
    has_disclaimer: bool = Field(default=False)
    disclaimer_text: Optional[str] = None
    reference_url: Optional[str] = None
    url_status: Optional[str] = Field(default=None, description="链接状态: valid/invalid/unknown")
    url_error: Optional[str] = None
    desensitization_notes: Optional[str] = Field(default=None, description="脱敏规则备注")
    gray_batch: Optional[str] = Field(default=None, description="灰度批次")
    source_batch: Optional[str] = Field(default=None, description="来源批次")
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    status: str = Field(default="pending", description="pending/passed/failed/conflict/manual_fixed")
    reviewer: Optional[str] = None
    review_comment: Optional[str] = None
    next_action: Optional[str] = Field(default=None, description="下一步: pm_review/editor_review/complete")
    conflict_reason: Optional[str] = Field(default=None, description="冲突原因说明")
    missing_materials: Optional[str] = Field(default=None, description="缺少的材料")

    check_results: List["CheckResult"] = Relationship(back_populates="qa_record")
    operation_logs: List["OperationLog"] = Relationship(back_populates="qa_record")


class CheckResult(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    qa_record_id: int = Field(foreign_key="qarecord.id")
    check_type: str
    check_passed: bool
    details: Optional[str] = None
    checked_by: str = Field(default="system")
    checked_at: datetime = Field(default_factory=datetime.now)
    run_id: Optional[str] = None

    qa_record: QARecord = Relationship(back_populates="check_results")


class OperationLog(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    qa_record_id: int = Field(foreign_key="qarecord.id")
    operation_type: str
    operator: str
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    field_name: Optional[str] = None
    reason: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.now)
    run_id: Optional[str] = None

    qa_record: QARecord = Relationship(back_populates="operation_logs")

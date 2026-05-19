from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class DNSRecordDiffBase(BaseModel):
    record_name: str
    record_type: str
    old_value: Optional[str] = None
    new_value: str
    old_ttl: Optional[int] = None
    new_ttl: int


class DNSRecordDiffCreate(DNSRecordDiffBase):
    pass


class DNSRecordDiff(DNSRecordDiffBase):
    id: int
    task_id: int
    diff_status: Optional[str] = None
    ttl_risk: bool = False
    ttl_risk_reason: Optional[str] = None

    class Config:
        from_attributes = True


class TaskOperationLogBase(BaseModel):
    operation: str
    operator: str
    original_input: Optional[str] = None
    conclusion: Optional[str] = None
    remark: Optional[str] = None


class TaskOperationLogCreate(TaskOperationLogBase):
    pass


class TaskOperationLog(TaskOperationLogBase):
    id: int
    task_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class DNSPreviewTaskBase(BaseModel):
    domain: str
    record_type: str
    old_target: str
    new_target: str
    ttl_strategy: int = Field(default=300, ge=1)
    created_by: str


class DNSPreviewTaskCreate(DNSPreviewTaskBase):
    records: List[DNSRecordDiffCreate]


class DNSPreviewTaskUpdate(BaseModel):
    old_target: Optional[str] = None
    new_target: Optional[str] = None
    ttl_strategy: Optional[int] = Field(default=None, ge=1)
    conclusion: Optional[str] = None


class DNSPreviewTask(DNSPreviewTaskBase):
    id: int
    current_ttl: Optional[int] = None
    status: str
    conclusion: Optional[str] = None
    risk_level: Optional[str] = None
    risk_reason: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    rollback_target: Optional[str] = None
    records: List[DNSRecordDiff] = []
    operations: List[TaskOperationLog] = []

    class Config:
        from_attributes = True


class StatusTransition(BaseModel):
    target_status: str
    operator: str
    remark: Optional[str] = None


class ManualCorrection(BaseModel):
    operator: str
    old_target: Optional[str] = None
    new_target: Optional[str] = None
    ttl_strategy: Optional[int] = None
    records: Optional[List[DNSRecordDiffCreate]] = None
    remark: Optional[str] = None


class TaskClose(BaseModel):
    operator: str
    reason: str
    conclusion: Optional[str] = None


class PreviewReport(BaseModel):
    task_id: int
    domain: str
    status: str
    risk_level: Optional[str] = None
    risk_reason: Optional[str] = None
    record_diffs: int
    high_risk_records: int
    conclusion: Optional[str] = None
    created_by: str
    created_at: datetime


class TTLRiskAssessment(BaseModel):
    record_name: str
    old_ttl: Optional[int]
    new_ttl: int
    is_risky: bool
    risk_reason: str
    recommended_action: str

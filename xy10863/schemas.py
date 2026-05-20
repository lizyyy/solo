from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List, Dict, Any


class RestoreRecordBase(BaseModel):
    title: str = Field(..., max_length=200)
    description: Optional[str] = None
    backup_point_id: str
    backup_point_time: datetime
    source_environment: str
    target_environment: str
    restore_scope: Dict[str, Any]
    applicant: str
    applicant_email: Optional[str] = None
    reason: str
    scheduled_time: Optional[datetime] = None


class RestoreRecordCreate(RestoreRecordBase):
    pass


class RestoreRecordUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    scheduled_time: Optional[datetime] = None


class RestoreRecord(RestoreRecordBase):
    id: int
    status: str
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime] = None
    rollback_available: bool
    verification_required: bool

    class Config:
        from_attributes = True


class RestoreRecordDetail(RestoreRecord):
    approvals: List["Approval"] = []
    execution_steps: List["ExecutionStep"] = []
    verification_results: List["VerificationResult"] = []
    change_logs: List["ChangeLog"] = []


class ApprovalBase(BaseModel):
    record_id: int
    approver: str
    approval_type: str
    comment: Optional[str] = None


class ApprovalCreate(ApprovalBase):
    pass


class Approval(ApprovalBase):
    id: int
    status: str
    approved_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ExecutionStepBase(BaseModel):
    record_id: int
    step_number: int
    step_name: str
    description: Optional[str] = None
    rollback_script: Optional[str] = None


class ExecutionStepCreate(ExecutionStepBase):
    pass


class ExecutionStepUpdate(BaseModel):
    status: Optional[str] = None
    result: Optional[str] = None
    error_message: Optional[str] = None


class ExecutionStep(ExecutionStepBase):
    id: int
    status: str
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class VerificationResultBase(BaseModel):
    record_id: int
    verification_type: str
    description: Optional[str] = None
    expected_value: Optional[str] = None


class VerificationResultCreate(VerificationResultBase):
    pass


class VerificationResultUpdate(BaseModel):
    status: Optional[str] = None
    actual_value: Optional[str] = None
    passed: Optional[bool] = None
    verified_by: Optional[str] = None
    remarks: Optional[str] = None


class VerificationResult(VerificationResultBase):
    id: int
    status: str
    actual_value: Optional[str] = None
    passed: Optional[bool] = None
    verified_by: Optional[str] = None
    verified_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ChangeLogBase(BaseModel):
    record_id: int
    action: str
    changed_by: str
    comment: Optional[str] = None
    details: Optional[Dict[str, Any]] = None


class ChangeLogCreate(ChangeLogBase):
    previous_status: Optional[str] = None
    new_status: Optional[str] = None


class ChangeLog(ChangeLogBase):
    id: int
    previous_status: Optional[str] = None
    new_status: Optional[str] = None
    changed_at: datetime

    class Config:
        from_attributes = True


class BackupPointBase(BaseModel):
    backup_id: str
    environment: str
    backup_time: datetime
    size: Optional[str] = None
    databases: Optional[List[str]] = None
    tables: Optional[Dict[str, List[str]]] = None
    storage_path: Optional[str] = None
    description: Optional[str] = None


class BackupPointCreate(BackupPointBase):
    pass


class BackupPoint(BackupPointBase):
    id: int
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class StatusTransition(BaseModel):
    new_status: str
    comment: Optional[str] = None
    operator: str


class ApprovalAction(BaseModel):
    approved: bool
    comment: Optional[str] = None
    approver: str


class StepExecution(BaseModel):
    operator: str
    comment: Optional[str] = None


class QueryParams(BaseModel):
    status: Optional[str] = None
    applicant: Optional[str] = None
    source_environment: Optional[str] = None
    target_environment: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    page: int = 1
    page_size: int = 20


class PaginatedResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: List[RestoreRecord]


RestoreRecordDetail.model_rebuild()

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class ApprovalStatus(str, Enum):
    DRAFT = "draft"
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    REJECTED = "rejected"
    IN_TRANSIT = "in_transit"
    AT_DESTINATION = "at_destination"
    RETURNING = "returning"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    FAILED = "failed"


class TaskStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    RETRYING = "retrying"
    CANCELLED = "cancelled"


class OperationType(str, Enum):
    CREATE = "create"
    UPDATE = "update"
    SUBMIT = "submit"
    APPROVE = "approve"
    REJECT = "reject"
    ISSUE_INSURANCE = "issue_insurance"
    UPDATE_TRANSPORT = "update_transport"
    ENVIRONMENT_RECORD = "environment_record"
    RETURN_INSPECTION = "return_inspection"
    COMPLETE = "complete"
    CANCEL = "cancel"
    RETRY = "retry"
    ROLLBACK = "rollback"


class CollectionItemBase(BaseModel):
    item_code: str
    name: str
    category: Optional[str] = None
    era: Optional[str] = None
    description: Optional[str] = None
    current_location: Optional[str] = None
    condition: Optional[str] = None
    value: Optional[float] = None


class CollectionItemCreate(CollectionItemBase):
    pass


class CollectionItemUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    era: Optional[str] = None
    description: Optional[str] = None
    current_location: Optional[str] = None
    condition: Optional[str] = None
    value: Optional[float] = None
    is_available: Optional[bool] = None


class CollectionItem(CollectionItemBase):
    id: int
    is_available: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class OutboundApprovalBase(BaseModel):
    item_id: int
    borrower: str
    borrower_contact: Optional[str] = None
    purpose: str
    destination: str
    start_date: datetime
    end_date: datetime
    applicant: str
    applicant_department: Optional[str] = None
    comments: Optional[str] = None


class OutboundApprovalCreate(OutboundApprovalBase):
    pass


class OutboundApprovalUpdate(BaseModel):
    borrower: Optional[str] = None
    borrower_contact: Optional[str] = None
    purpose: Optional[str] = None
    destination: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    comments: Optional[str] = None


class ApprovalAction(BaseModel):
    approver: str
    approver_role: str
    comments: Optional[str] = None


class OutboundApproval(OutboundApprovalBase):
    id: int
    approval_no: str
    status: ApprovalStatus
    current_approver: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class OutboundApprovalDetail(OutboundApproval):
    item: CollectionItem
    insurance: Optional["InsurancePolicy"] = None
    transport_records: List["TransportRecord"] = []
    environment_logs: List["EnvironmentLog"] = []
    return_inspection: Optional["ReturnInspection"] = None
    operation_history: List["OperationHistory"] = []
    tasks: List["BackgroundTask"] = []


class InsurancePolicyBase(BaseModel):
    insurance_company: str
    insured_value: float
    coverage_start: datetime
    coverage_end: datetime
    coverage_details: Optional[str] = None


class InsurancePolicyCreate(InsurancePolicyBase):
    approval_id: int
    item_id: int


class InsurancePolicyUpdate(BaseModel):
    insurance_company: Optional[str] = None
    insured_value: Optional[float] = None
    coverage_start: Optional[datetime] = None
    coverage_end: Optional[datetime] = None
    coverage_details: Optional[str] = None
    status: Optional[str] = None
    policy_document_url: Optional[str] = None


class InsurancePolicy(InsurancePolicyBase):
    id: int
    policy_no: str
    approval_id: int
    item_id: int
    status: str
    issued_at: Optional[datetime] = None
    policy_document_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class TransportRecordBase(BaseModel):
    approval_id: int
    sequence: int
    node_name: str
    node_type: Optional[str] = None
    location: Optional[str] = None
    handler: Optional[str] = None
    handler_contact: Optional[str] = None
    arrival_time: Optional[datetime] = None
    departure_time: Optional[datetime] = None
    condition_check: Optional[str] = None
    remarks: Optional[str] = None


class TransportRecordCreate(TransportRecordBase):
    pass


class TransportRecordUpdate(BaseModel):
    node_name: Optional[str] = None
    node_type: Optional[str] = None
    location: Optional[str] = None
    handler: Optional[str] = None
    handler_contact: Optional[str] = None
    arrival_time: Optional[datetime] = None
    departure_time: Optional[datetime] = None
    condition_check: Optional[str] = None
    remarks: Optional[str] = None


class TransportRecord(TransportRecordBase):
    id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class EnvironmentLogBase(BaseModel):
    approval_id: int
    record_time: datetime
    temperature: Optional[float] = None
    humidity: Optional[float] = None
    light_level: Optional[float] = None
    vibration: Optional[float] = None
    status: Optional[str] = "normal"
    notes: Optional[str] = None
    operator: Optional[str] = None
    transport_record_id: Optional[int] = None


class EnvironmentLogCreate(EnvironmentLogBase):
    pass


class EnvironmentLog(EnvironmentLogBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True


class ReturnInspectionBase(BaseModel):
    approval_id: int
    return_date: datetime
    inspector: str
    inspector_department: Optional[str] = None
    condition_before: Optional[str] = None
    condition_after: Optional[str] = None
    damage_found: Optional[bool] = False
    damage_description: Optional[str] = None
    packaging_check: Optional[str] = None
    documents_complete: Optional[bool] = True
    missing_items: Optional[str] = None
    overall_status: Optional[str] = "normal"
    recommendations: Optional[str] = None
    signature_url: Optional[str] = None


class ReturnInspectionCreate(ReturnInspectionBase):
    pass


class ReturnInspection(ReturnInspectionBase):
    id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class OperationHistory(BaseModel):
    id: int
    approval_id: int
    operation_type: OperationType
    operator: str
    operator_role: Optional[str] = None
    old_status: Optional[str] = None
    new_status: Optional[str] = None
    description: Optional[str] = None
    details: Optional[Dict[str, Any]] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class BackgroundTaskBase(BaseModel):
    task_type: str
    approval_id: Optional[int] = None
    payload: Optional[Dict[str, Any]] = None


class BackgroundTaskCreate(BackgroundTaskBase):
    pass


class BackgroundTaskRetry(BaseModel):
    force: bool = False


class BackgroundTask(BaseModel):
    id: int
    task_id: str
    task_type: str
    approval_id: Optional[int] = None
    status: TaskStatus
    attempts: int
    max_attempts: int
    payload: Optional[Dict[str, Any]] = None
    result: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    error_trace: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    last_attempt_at: Optional[datetime] = None
    next_retry_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class TaskRetryRequest(BaseModel):
    task_id: str
    operator: str
    force: bool = False


class ApprovalTraceResponse(BaseModel):
    approval: OutboundApproval
    transport_records: List[TransportRecord]
    environment_logs: List[EnvironmentLog]
    insurance: Optional[InsurancePolicy]
    return_inspection: Optional[ReturnInspection]
    operation_history: List[OperationHistory]
    timeline: List[Dict[str, Any]]


class ResponseModel(BaseModel):
    success: bool
    message: str
    data: Optional[Any] = None


OutboundApprovalDetail.model_rebuild()

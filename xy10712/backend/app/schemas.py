from pydantic import BaseModel, EmailStr, field_validator
from datetime import datetime
from typing import Optional, List, Dict, Any
from .models import TemplateStatus, BatchStatus, EmailStatus, ApprovalType, ApprovalStatus

class VariableDef(BaseModel):
    name: str
    type: str = "string"
    required: bool = True
    pattern: Optional[str] = None
    description: Optional[str] = None

class EmailTemplateBase(BaseModel):
    name: str
    subject: str
    content: str
    variables: List[VariableDef] = []

class EmailTemplateCreate(EmailTemplateBase):
    pass

class EmailTemplateUpdate(BaseModel):
    name: Optional[str] = None
    subject: Optional[str] = None
    content: Optional[str] = None
    variables: Optional[List[VariableDef]] = None
    change_description: Optional[str] = None

class EmailTemplateResponse(EmailTemplateBase):
    id: int
    version: int
    status: TemplateStatus
    created_by: str
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True

class TemplateVersionResponse(BaseModel):
    id: int
    template_id: int
    version: int
    subject: str
    content: str
    variables: List[VariableDef]
    created_by: str
    created_at: datetime
    change_description: Optional[str]

    class Config:
        from_attributes = True

class EmailRecipient(BaseModel):
    email: EmailStr
    name: Optional[str] = None
    variables: Dict[str, Any] = {}

class EmailBatchBase(BaseModel):
    name: str
    template_id: int
    test_recipients: List[EmailStr] = []
    total_stages: int = 3

class EmailBatchCreate(EmailBatchBase):
    recipients: List[EmailRecipient] = []

class EmailBatchResponse(BaseModel):
    id: int
    name: str
    template_id: int
    template_name: Optional[str] = None
    template_version: int
    grayscale_stage: int
    total_stages: int
    total_emails: int
    sent_emails: int
    success_count: int
    failed_count: int
    intercepted_count: int
    status: BatchStatus
    test_recipients: List[str]
    created_by: str
    created_at: datetime
    updated_at: Optional[datetime]
    completed_at: Optional[datetime]

    class Config:
        from_attributes = True

class EmailRecordResponse(BaseModel):
    id: int
    batch_id: int
    recipient_email: str
    recipient_name: Optional[str]
    status: EmailStatus
    is_test: bool
    grayscale_stage: int
    sent_at: Optional[datetime]
    error_message: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

class VariableValidationResponse(BaseModel):
    id: int
    email_id: int
    variable_name: str
    variable_value: str
    is_valid: bool
    error_message: Optional[str]
    validated_at: datetime
    recalculated_at: Optional[datetime]

    class Config:
        from_attributes = True

class ApprovalRecordBase(BaseModel):
    type: ApprovalType
    request_comment: Optional[str] = None

class ApprovalCreate(ApprovalRecordBase):
    template_id: Optional[int] = None
    batch_id: Optional[int] = None

class ApprovalAction(BaseModel):
    status: ApprovalStatus
    approval_comment: Optional[str] = None

class ApprovalRecordResponse(BaseModel):
    id: int
    type: ApprovalType
    template_id: Optional[int]
    batch_id: Optional[int]
    template_name: Optional[str] = None
    batch_name: Optional[str] = None
    status: ApprovalStatus
    requester: str
    approver: Optional[str]
    request_comment: Optional[str]
    approval_comment: Optional[str]
    requested_at: datetime
    approved_at: Optional[datetime]

    class Config:
        from_attributes = True

class BatchLogResponse(BaseModel):
    id: int
    batch_id: int
    action: str
    operator: str
    details: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

class TemplateDiff(BaseModel):
    field: str
    old_value: str
    new_value: str
    change_type: str

class TemplateDiffResponse(BaseModel):
    version_old: int
    version_new: int
    differences: List[TemplateDiff]

class StatisticsResponse(BaseModel):
    total_templates: int
    total_batches: int
    total_emails_sent: int
    success_rate: float
    pending_approvals: int
    batches_in_progress: int
    monthly_stats: Dict[str, Any]

class CompensationRequest(BaseModel):
    batch_id: int
    compensation_type: str
    email_ids: Optional[List[int]] = None
    details: Optional[str] = None

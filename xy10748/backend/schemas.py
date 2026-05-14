from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List, Dict, Any


class UserBase(BaseModel):
    username: str
    name: str
    email: str
    role: str
    department: str


class UserCreate(UserBase):
    pass


class UserResponse(UserBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True


class FormTemplateBase(BaseModel):
    name: str
    description: str
    fields: List[Dict[str, Any]]


class FormTemplateCreate(FormTemplateBase):
    created_by: int


class FormTemplateResponse(FormTemplateBase):
    id: int
    created_at: datetime
    is_active: bool
    
    class Config:
        from_attributes = True


class WorkflowBase(BaseModel):
    name: str
    description: str
    form_template_id: int
    nodes: List[Dict[str, Any]]
    edges: List[Dict[str, Any]]


class WorkflowCreate(WorkflowBase):
    created_by: int


class WorkflowResponse(WorkflowBase):
    id: int
    created_at: datetime
    is_active: bool
    
    class Config:
        from_attributes = True


class FormSubmissionBase(BaseModel):
    form_template_id: int
    workflow_id: int
    submitter_id: int
    form_data: Dict[str, Any]


class FormSubmissionCreate(FormSubmissionBase):
    pass


class FormSubmissionResponse(BaseModel):
    id: int
    submission_no: str
    form_template_id: int
    workflow_id: int
    submitter_id: int
    form_data: Dict[str, Any]
    status: str
    current_node_id: Optional[str]
    approval_history: List[Dict[str, Any]]
    timeout_reminded: bool
    is_withdrawn: bool
    resubmit_count: int
    created_at: datetime
    updated_at: datetime
    submitter: Optional[UserResponse]
    
    class Config:
        from_attributes = True


class ApprovalRecordBase(BaseModel):
    submission_id: int
    node_id: str
    node_name: str
    approver_id: int
    action: str
    comment: Optional[str] = None
    is_timeout: bool = False


class ApprovalRecordCreate(ApprovalRecordBase):
    pass


class ApprovalRecordResponse(ApprovalRecordBase):
    id: int
    approved_at: datetime
    approver: Optional[UserResponse]
    
    class Config:
        from_attributes = True


class ValidationRuleBase(BaseModel):
    workflow_id: int
    node_id: str
    field_name: str
    rule_type: str
    rule_config: Dict[str, Any]
    error_message: str


class ValidationRuleCreate(ValidationRuleBase):
    pass


class ValidationRuleResponse(ValidationRuleBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True


class ApprovalAction(BaseModel):
    submission_id: int
    approver_id: int
    action: str
    comment: Optional[str] = None


class WithdrawRequest(BaseModel):
    submission_id: int
    user_id: int
    reason: Optional[str] = None


class ResubmitRequest(BaseModel):
    submission_id: int
    form_data: Dict[str, Any]


class BatchImportRequest(BaseModel):
    submissions: List[Dict[str, Any]]
    workflow_id: int
    submitter_id: int


class ValidationErrorResponse(BaseModel):
    field: str
    message: str
    rule_type: str


class ValidationResponse(BaseModel):
    valid: bool
    errors: List[ValidationErrorResponse] = []

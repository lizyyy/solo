from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from app.models.approval import ApprovalStatus, ApprovalChainStatus

class ApprovalStepBase(BaseModel):
    step_order: int
    role: str
    approver: Optional[str] = None
    is_required: bool = True
    rules: Optional[str] = None

class ApprovalStepCreate(ApprovalStepBase):
    pass

class ApprovalStepUpdate(BaseModel):
    status: Optional[ApprovalStatus] = None
    comment: Optional[str] = None
    approver: Optional[str] = None

class ApprovalStepResponse(ApprovalStepBase):
    id: int
    chain_id: int
    status: ApprovalStatus
    comment: Optional[str] = None
    approved_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class ApprovalChainBase(BaseModel):
    remarks: Optional[str] = None

class ApprovalChainCreate(ApprovalChainBase):
    steps: List[ApprovalStepCreate] = Field(default_factory=list)

class ApprovalChainResponse(ApprovalChainBase):
    id: int
    migration_id: int
    status: ApprovalChainStatus
    current_step_index: int
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    steps: List[ApprovalStepResponse] = Field(default_factory=list)

    class Config:
        from_attributes = True
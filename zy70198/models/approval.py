from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class ApprovalStatus(str, Enum):
    PENDING = 'pending'
    APPROVED = 'approved'
    REJECTED = 'rejected'
    CANCELLED = 'cancelled'


class InsertionApproval(BaseModel):
    id: str = Field(..., description='审批ID')
    payment_plan_id: str = Field(..., description='关联的付款计划ID')
    
    original_queue_position: int = Field(..., description='原排队位置')
    requested_queue_position: int = Field(..., description='请求插入的位置')
    
    justification: str = Field(..., description='插单理由')
    impact_analysis: Optional[str] = Field(default=None, description='对其他付款计划的影响分析')
    
    requester: str = Field(..., description='申请人')
    approver: Optional[str] = Field(default=None, description='审批人')
    
    status: ApprovalStatus = Field(default=ApprovalStatus.PENDING, description='审批状态')
    
    submitted_at: datetime = Field(default_factory=datetime.now, description='提交时间')
    approved_at: Optional[datetime] = Field(default=None, description='审批时间')
    
    approval_comment: Optional[str] = Field(default=None, description='审批意见')
    
    created_at: datetime = Field(default_factory=datetime.now, description='创建时间')
    updated_at: datetime = Field(default_factory=datetime.now, description='更新时间')
    
    def mark_updated(self) -> None:
        self.updated_at = datetime.now()

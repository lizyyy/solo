from datetime import date, datetime
from enum import Enum
from typing import Optional, List
from pydantic import BaseModel, Field


class PaymentPlanStatus(str, Enum):
    DRAFT = 'draft'
    PENDING_SCHEDULE = 'pending_schedule'
    SCHEDULED = 'scheduled'
    PARTIALLY_PAID = 'partially_paid'
    FULLY_PAID = 'fully_paid'
    DELAYED = 'delayed'
    MANUAL_REVIEW = 'manual_review'
    CANCELLED = 'cancelled'


class PaymentPriority(str, Enum):
    NORMAL = 'normal'
    HIGH = 'high'
    URGENT = 'urgent'


class PaymentPlan(BaseModel):
    id: str = Field(..., description='付款计划唯一标识')
    purchase_order_id: str = Field(..., description='采购订单号')
    vendor_id: str = Field(..., description='供应商ID')
    vendor_name: str = Field(..., description='供应商名称')
    
    contract_payment_terms: str = Field(..., description='合同付款条款原文')
    credit_period_days: int = Field(..., description='账期天数')
    
    total_amount: float = Field(..., gt=0, description='计划付款总金额')
    paid_amount: float = Field(default=0, description='已付款金额')
    
    invoice_ids: List[str] = Field(default_factory=list, description='关联的发票ID列表')
    
    priority: PaymentPriority = Field(default=PaymentPriority.NORMAL, description='付款优先级')
    is_insertion: bool = Field(default=False, description='是否为插单')
    insertion_approval_id: Optional[str] = Field(default=None, description='插单审批记录ID')
    
    expected_payment_date: Optional[date] = Field(default=None, description='最初期望付款日期')
    current_payment_date: Optional[date] = Field(default=None, description='当前排定付款日期')
    
    status: PaymentPlanStatus = Field(default=PaymentPlanStatus.DRAFT, description='付款计划状态')
    
    created_by: str = Field(..., description='创建人')
    created_at: datetime = Field(default_factory=datetime.now, description='创建时间')
    updated_at: datetime = Field(default_factory=datetime.now, description='更新时间')
    
    remark: Optional[str] = Field(default=None, description='备注')
    
    @property
    def remaining_amount(self) -> float:
        return self.total_amount - self.paid_amount
    
    def mark_updated(self) -> None:
        self.updated_at = datetime.now()

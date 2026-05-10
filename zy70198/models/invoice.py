from datetime import date, datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class InvoiceStatus(str, Enum):
    PENDING_RECEIVED = 'pending_received'
    RECEIVED = 'received'
    VERIFIED = 'verified'
    MATCHED = 'matched'
    PARTIALLY_USED = 'partially_used'
    FULLY_USED = 'fully_used'
    INVALID = 'invalid'


class Invoice(BaseModel):
    id: str = Field(..., description='发票唯一标识')
    invoice_no: str = Field(..., description='发票号码')
    invoice_code: Optional[str] = Field(default=None, description='发票代码')
    
    vendor_id: str = Field(..., description='供应商ID')
    purchase_order_id: str = Field(..., description='关联采购订单号')
    
    invoice_date: date = Field(..., description='发票开票日期')
    invoice_amount: float = Field(..., gt=0, description='发票金额')
    tax_amount: Optional[float] = Field(default=None, description='税额')
    
    received_date: Optional[date] = Field(default=None, description='发票收到日期')
    verified_date: Optional[date] = Field(default=None, description='发票认证/勾选日期')
    
    matched_payment_plan_id: Optional[str] = Field(default=None, description='匹配的付款计划ID')
    used_amount: float = Field(default=0, description='已使用金额')
    
    status: InvoiceStatus = Field(default=InvoiceStatus.PENDING_RECEIVED, description='发票状态')
    
    created_at: datetime = Field(default_factory=datetime.now, description='创建时间')
    updated_at: datetime = Field(default_factory=datetime.now, description='更新时间')
    
    remark: Optional[str] = Field(default=None, description='备注')
    
    @property
    def remaining_amount(self) -> float:
        return self.invoice_amount - self.used_amount
    
    def mark_updated(self) -> None:
        self.updated_at = datetime.now()

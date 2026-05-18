from pydantic import BaseModel, Field
from datetime import date, datetime
from typing import Optional, List
from models import ReductionStatus, ReductionType, InvoiceStatus


class StallBase(BaseModel):
    stall_number: str = Field(..., description="摊位编号")
    stall_area: float = Field(..., description="摊位面积(平方米)")
    stall_type: str = Field(..., description="摊位类型")
    market_zone: str = Field(..., description="所属区域")
    monthly_fee_standard: float = Field(..., description="月费标准(元)")


class StallCreate(StallBase):
    pass


class Stall(StallBase):
    id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class VendorBase(BaseModel):
    vendor_name: str = Field(..., description="摊主姓名")
    id_card_number: str = Field(..., description="身份证号")
    phone_number: str = Field(..., description="联系电话")
    business_scope: str = Field(..., description="经营范围")
    contract_start_date: date = Field(..., description="合同开始日期")
    contract_end_date: date = Field(..., description="合同结束日期")


class VendorCreate(VendorBase):
    stall_id: int


class Vendor(VendorBase):
    id: int
    stall_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class MarketClosureBase(BaseModel):
    closure_notice_no: str = Field(..., description="休市通知编号")
    closure_title: str = Field(..., description="休市标题")
    closure_reason: str = Field(..., description="休市原因")
    start_date: date = Field(..., description="休市开始日期")
    end_date: date = Field(..., description="休市结束日期")
    affected_zones: str = Field(..., description="影响区域")
    issuer_department: str = Field(..., description="发布部门")
    issued_at: date = Field(..., description="发布日期")


class MarketClosureCreate(MarketClosureBase):
    pass


class MarketClosure(MarketClosureBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class PersonalLeaveBase(BaseModel):
    leave_no: str = Field(..., description="请假编号")
    leave_reason: str = Field(..., description="请假原因")
    start_date: date = Field(..., description="请假开始日期")
    end_date: date = Field(..., description="请假结束日期")
    leave_days: int = Field(..., description="请假天数")
    approver: str = Field(..., description="审批人")
    approved_at: date = Field(..., description="审批日期")


class PersonalLeaveCreate(PersonalLeaveBase):
    vendor_id: int


class PersonalLeave(PersonalLeaveBase):
    id: int
    vendor_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class FeeRecordBase(BaseModel):
    fee_month: str = Field(..., description="缴费月份")
    fee_amount: float = Field(..., description="应缴金额")
    paid_amount: float = Field(0, description="已缴金额")
    payment_deadline: date = Field(..., description="缴费截止日期")
    payment_date: Optional[date] = Field(None, description="实际缴费日期")
    invoice_status: InvoiceStatus = Field(InvoiceStatus.NOT_ISSUED, description="票据状态")
    invoice_no: Optional[str] = Field(None, description="票据编号")


class FeeRecordCreate(FeeRecordBase):
    stall_id: int


class FeeRecord(FeeRecordBase):
    id: int
    stall_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class FeeReductionBase(BaseModel):
    reduction_no: str = Field(..., description="减免编号")
    reduction_type: ReductionType = Field(..., description="减免类型")
    reduction_month: str = Field(..., description="减免月份")
    reduction_amount: float = Field(..., description="减免金额")
    closure_id: Optional[int] = Field(None, description="关联休市ID")
    leave_id: Optional[int] = Field(None, description="关联请假ID")
    applicant: str = Field(..., description="申请人")
    application_date: date = Field(..., description="申请日期")
    review_deadline: date = Field(..., description="复核截止日期")
    invoice_status: InvoiceStatus = Field(InvoiceStatus.NOT_ISSUED, description="票据状态")
    remarks: Optional[str] = Field(None, description="备注")


class FeeReductionCreate(FeeReductionBase):
    stall_id: int
    vendor_id: int


class FeeReductionImport(BaseModel):
    reduction_no: str
    stall_number: str
    reduction_type: ReductionType
    reduction_month: str
    reduction_amount: float
    closure_notice_no: Optional[str] = None
    leave_no: Optional[str] = None
    applicant: str
    application_date: date
    review_deadline: date
    remarks: Optional[str] = None


class FeeReductionProcess(BaseModel):
    processor: str = Field(..., description="处理人")


class FeeReductionReview(BaseModel):
    reviewer: str = Field(..., description="复核人")
    approved: bool = Field(..., description="是否通过")
    reject_reason: Optional[str] = Field(None, description="驳回原因")


class FeeReduction(FeeReductionBase):
    id: int
    stall_id: int
    vendor_id: int
    status: ReductionStatus
    reject_reason: Optional[str]
    processor: Optional[str]
    processed_at: Optional[date]
    reviewer: Optional[str]
    reviewed_at: Optional[date]
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class ReductionResult(BaseModel):
    success: bool
    reduction: Optional[FeeReduction] = None
    message: Optional[str] = None
    need_manual: bool = False
    manual_reason: Optional[str] = None


class ErrorResponse(BaseModel):
    error_code: str
    error_message: str
    suggestion: str
    reduction_no: Optional[str] = None

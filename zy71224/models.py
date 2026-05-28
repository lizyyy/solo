from datetime import datetime, date
from enum import Enum
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, validator


class SurrenderStatus(str, Enum):
    PENDING = "待处理"
    REVIEWING = "审核中"
    APPROVED = "已通过"
    REJECTED = "已拒绝"
    REFUNDED = "已退费"
    EXCEPTION = "异常"
    DISPUTE = "争议"


class VisitStatus(str, Enum):
    NOT_VISITED = "未回访"
    VISITED = "已回访"
    VISIT_FAILED = "回访失败"


class DataVersion(BaseModel):
    version: int
    import_time: datetime
    source_file: str
    record_count: int


class Policy(BaseModel):
    policy_no: str = Field(..., description="保单号")
    policy_name: str = Field(..., description="险种名称")
    applicant_name: str = Field(..., description="投保人姓名")
    insured_name: str = Field(..., description="被保险人姓名")
    premium: float = Field(..., description="保费金额")
    policy_date: date = Field(..., description="保单生效日期")
    policy_period: int = Field(..., description="保险期间(年)")
    payment_method: str = Field(..., description="缴费方式")
    
    class Config:
        orm_mode = True


class SignRecord(BaseModel):
    policy_no: str = Field(..., description="保单号")
    sign_date: date = Field(..., description="签收日期")
    sign_person: str = Field(..., description="签收人")
    sign_method: str = Field(default="纸质", description="签收方式")
    delivery_no: Optional[str] = Field(None, description="快递单号")
    
    class Config:
        orm_mode = True


class VisitRecord(BaseModel):
    policy_no: str = Field(..., description="保单号")
    visit_date: datetime = Field(..., description="回访时间")
    visitor: str = Field(..., description="回访人员")
    visit_status: VisitStatus = Field(..., description="回访状态")
    visit_result: str = Field(..., description="回访结果")
    recording_file: Optional[str] = Field(None, description="录音文件路径")
    visit_notes: Optional[str] = Field(None, description="回访备注")
    
    class Config:
        orm_mode = True


class FeeRecord(BaseModel):
    policy_no: str = Field(..., description="保单号")
    fee_date: date = Field(..., description="扣费日期")
    fee_amount: float = Field(..., description="扣费金额")
    fee_type: str = Field(..., description="费用类型")
    transaction_no: str = Field(..., description="交易流水号")
    payment_channel: str = Field(..., description="扣费渠道")
    
    class Config:
        orm_mode = True


class SurrenderApplication(BaseModel):
    policy_no: str = Field(..., description="保单号")
    apply_no: str = Field(..., description="申请编号")
    apply_date: date = Field(..., description="申请日期")
    applicant: str = Field(..., description="申请人")
    surrender_reason: str = Field(..., description="退保原因")
    surrender_type: str = Field(default="全额退保", description="退保类型")
    apply_channel: str = Field(..., description="申请渠道")
    apply_notes: Optional[str] = Field(None, description="申请备注")
    
    class Config:
        orm_mode = True


class SurrenderReview(BaseModel):
    policy_no: str = Field(..., description="保单号")
    apply_no: str = Field(..., description="申请编号")
    reviewer: str = Field(..., description="审核人员")
    review_time: datetime = Field(..., description="审核时间")
    review_result: SurrenderStatus = Field(..., description="审核结果")
    review_notes: str = Field(..., description="审核意见")
    
    class Config:
        orm_mode = True


class RefundRecord(BaseModel):
    policy_no: str = Field(..., description="保单号")
    apply_no: str = Field(..., description="申请编号")
    refund_no: str = Field(..., description="退费编号")
    refund_date: date = Field(..., description="退费日期")
    refund_amount: float = Field(..., description="退费金额")
    deduction_amount: float = Field(..., description="扣除金额")
    deduction_detail: Dict[str, float] = Field(..., description="扣费明细")
    refund_channel: str = Field(..., description="退费渠道")
    refund_status: str = Field(..., description="退费状态")
    
    class Config:
        orm_mode = True


class SurrenderException(BaseModel):
    policy_no: str = Field(..., description="保单号")
    apply_no: Optional[str] = Field(None, description="申请编号")
    exception_type: str = Field(..., description="异常类型")
    exception_level: str = Field(..., description="异常级别")
    exception_desc: str = Field(..., description="异常描述")
    detect_time: datetime = Field(default_factory=datetime.now, description="发现时间")
    suggested_action: str = Field(..., description="建议处理方式")
    handler: Optional[str] = Field(None, description="处理人")
    is_resolved: bool = Field(default=False, description="是否已解决")
    resolve_notes: Optional[str] = Field(None, description="处理备注")
    
    class Config:
        orm_mode = True


class SurrenderProcess(BaseModel):
    policy_no: str = Field(..., description="保单号")
    apply_no: str = Field(..., description="申请编号")
    policy: Optional[Policy] = None
    sign_record: Optional[SignRecord] = None
    visit_records: List[VisitRecord] = Field(default_factory=list)
    fee_records: List[FeeRecord] = Field(default_factory=list)
    application: Optional[SurrenderApplication] = None
    reviews: List[SurrenderReview] = Field(default_factory=list)
    refund: Optional[RefundRecord] = None
    exceptions: List[SurrenderException] = Field(default_factory=list)
    
    cooling_off_days_used: Optional[int] = None
    is_within_cooling_off: Optional[bool] = None
    status: SurrenderStatus = SurrenderStatus.PENDING
    process_notes: Optional[str] = None

from datetime import datetime, date
from typing import Optional, List
from pydantic import BaseModel, Field


class CustomerBase(BaseModel):
    id_card: str = Field(..., max_length=18, description="身份证号")
    name: str = Field(..., max_length=50, description="客户姓名")
    phone: Optional[str] = Field(None, max_length=20, description="手机号")


class CustomerCreate(CustomerBase):
    pass


class CustomerResponse(CustomerBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class LoanApplicationBase(BaseModel):
    loan_amount: float = Field(..., gt=0, description="贷款金额")
    loan_term: Optional[int] = Field(None, gt=0, description="贷款期限")


class LoanApplicationCreate(LoanApplicationBase):
    customer_id: int


class LoanApplicationResponse(LoanApplicationBase):
    id: int
    application_no: str
    customer_id: int
    status: str
    review_status: str
    submitted_at: datetime
    customer: CustomerResponse

    class Config:
        from_attributes = True


class DocumentBase(BaseModel):
    doc_type: str = Field(..., max_length=50, description="资料类型")
    doc_no: Optional[str] = Field(None, max_length=100, description="资料编号")
    issue_date: Optional[date] = Field(None, description="签发日期")
    expiry_date: Optional[date] = Field(None, description="过期日期")


class DocumentCreate(DocumentBase):
    application_id: int


class DocumentResponse(DocumentBase):
    id: int
    application_id: int
    is_valid: bool
    version: int
    created_at: datetime

    class Config:
        from_attributes = True


class CancellationBase(BaseModel):
    reason: str = Field(..., max_length=50, description="撤件原因")
    reason_detail: Optional[str] = Field(None, description="原因详情")
    operator: str = Field(..., max_length=50, description="操作人")


class CancellationCreate(CancellationBase):
    application_id: int


class CancellationResponse(CancellationBase):
    id: int
    application_id: int
    cancellation_no: str
    cancelled_at: datetime
    is_idempotent: bool

    class Config:
        from_attributes = True


class CancellationResult(BaseModel):
    success: bool
    message: str
    warnings: List[str] = Field(default_factory=list)
    cancellation: Optional[CancellationResponse] = None


class FollowupBase(BaseModel):
    followup_type: str = Field(..., max_length=50, description="回访类型")
    content: str = Field(..., description="回访内容")
    operator: str = Field(..., max_length=50, description="操作人")
    parent_id: Optional[int] = Field(None, description="父记录ID，用于修正")


class FollowupCreate(FollowupBase):
    application_id: int


class FollowupResponse(FollowupBase):
    id: int
    application_id: int
    followup_at: datetime
    version: int
    is_original: bool

    class Config:
        from_attributes = True


class CancellationListSummary(BaseModel):
    id: int
    list_no: str
    batch_date: date
    total_count: int
    customer_regret_count: int
    doc_expired_count: int
    risk_rejected_count: int
    operator: str
    exported_at: Optional[datetime]

    class Config:
        from_attributes = True


class CancellationListItemResponse(BaseModel):
    customer_name: str
    id_card: str
    application_no: str
    loan_amount: float
    cancellation_reason: str
    review_status: str
    warnings: Optional[str]

    class Config:
        from_attributes = True


class StatusChangeRequest(BaseModel):
    to_status: str = Field(..., description="目标状态")
    operator: str = Field(..., max_length=50, description="操作人")
    remark: Optional[str] = Field(None, description="备注")


class StatusChangeResponse(BaseModel):
    success: bool
    message: str
    from_status: Optional[str] = None
    to_status: Optional[str] = None


class RiskAssessmentBase(BaseModel):
    risk_score: Optional[int] = Field(None, description="风险评分")
    risk_level: Optional[str] = Field(None, max_length=20, description="风险等级")
    result: str = Field(..., max_length=20, description="风控结果")
    reviewer: Optional[str] = Field(None, max_length=50, description="审核人")
    review_comment: Optional[str] = Field(None, description="审核意见")


class RiskAssessmentCreate(RiskAssessmentBase):
    application_id: int


class RiskAssessmentResponse(RiskAssessmentBase):
    id: int
    application_id: int
    assessed_at: datetime

    class Config:
        from_attributes = True


class ErrorResponse(BaseModel):
    detail: str
    code: Optional[str] = None


class ApplicationDetailResponse(BaseModel):
    application: LoanApplicationResponse
    documents: List[DocumentResponse]
    risk_results: List[RiskAssessmentResponse]
    cancellations: List[CancellationResponse]
    followups: List[FollowupResponse]
    warnings: List[str] = Field(default_factory=list)
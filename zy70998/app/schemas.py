from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


# ── Import ──────────────────────────────────────────────

class ImportBatchResponse(BaseModel):
    id: int
    batch_no: str
    batch_type: str
    file_name: str
    record_count: int
    operator: str
    remark: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class ImportSummary(BaseModel):
    batch_no: str
    batch_type: str
    file_name: str
    total_rows: int
    imported_rows: int
    skipped_rows: int
    skipped_reasons: List[str] = []


# ── Employee ────────────────────────────────────────────

class EmployeeBase(BaseModel):
    emp_no: str
    name: str
    department: Optional[str] = None
    status: str = "active"
    phone: Optional[str] = None
    id_card: Optional[str] = None
    remark: Optional[str] = None


class EmployeeCreate(EmployeeBase):
    pass


class EmployeeResponse(EmployeeBase):
    id: int
    batch_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ── Coupon ──────────────────────────────────────────────

class CouponBase(BaseModel):
    coupon_code: str
    coupon_type: str
    face_value: float = 0
    status: str = "unused"
    batch_no: Optional[str] = None
    issued_emp_no: Optional[str] = None
    issued_name: Optional[str] = None
    expire_date: Optional[str] = None


class CouponCreate(CouponBase):
    pass


class CouponResponse(CouponBase):
    id: int
    batch_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ── Requisition ─────────────────────────────────────────

class RequisitionBase(BaseModel):
    emp_no: str
    emp_name: str
    department: Optional[str] = None
    coupon_code: Optional[str] = None
    coupon_type: Optional[str] = None
    claim_type: str = "线下领取"
    claim_date: Optional[str] = None
    claim_amount: float = 0
    proxy_emp_no: Optional[str] = None
    proxy_name: Optional[str] = None
    remark: Optional[str] = None


class RequisitionCreate(RequisitionBase):
    batch_id: int


class RequisitionResponse(RequisitionBase):
    id: int
    batch_id: int
    created_at: datetime

    class Config:
        from_attributes = True


# ── Reconciliation ──────────────────────────────────────

class ReconciliationListItem(BaseModel):
    id: int
    requisition_id: int
    batch_no: str
    emp_no: str
    emp_name: str
    department: Optional[str]
    coupon_code: Optional[str]
    coupon_type: Optional[str]
    claim_type: str
    claim_date: Optional[str]
    claim_amount: float
    employee_match: str
    coupon_match: str
    is_resigned: bool
    is_duplicate: bool
    is_proxy: bool
    anomaly_flags: Optional[str]
    review_status: str
    final_status: str
    final_amount: float
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ReconciliationDetail(BaseModel):
    id: int
    batch_no: str
    requisition: dict
    employee_match: str
    employee_mismatch_reason: Optional[str]
    coupon_match: str
    coupon_mismatch_reason: Optional[str]
    is_resigned: bool
    resigned_detail: Optional[str]
    is_duplicate: bool
    duplicate_with: Optional[str]
    is_proxy: bool
    proxy_detail: Optional[str]
    anomaly_flags: Optional[str]
    review_status: str
    review_operator: Optional[str]
    review_comment: Optional[str]
    reviewed_at: Optional[datetime]
    final_status: str
    final_amount: float
    final_remark: Optional[str]
    review_logs: List[dict] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ReconciliationListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: List[ReconciliationListItem]


# ── Review ──────────────────────────────────────────────

class ReviewRequest(BaseModel):
    action: str = Field(..., description="approve | reject | return")
    comment: str = Field(..., description="复核说明，用于解释差异来源或放行/退回理由")
    operator: str = Field(..., description="操作人姓名")
    final_amount: Optional[float] = Field(None, description="修改后的最终金额")


class ReviewResponse(BaseModel):
    reconciliation_id: int
    action: str
    old_status: str
    new_status: str
    comment: str
    operator: str
    created_at: datetime

    class Config:
        from_attributes = True


# ── Report ──────────────────────────────────────────────

class ReportGenerateRequest(BaseModel):
    title: str
    batch_nos: List[str] = Field(..., description="要纳入报告的批次号列表")
    generated_by: str = "system"


class ReportSummary(BaseModel):
    report_id: int
    report_no: str
    title: str
    total_records: int
    approved_count: int
    rejected_count: int
    pending_count: int
    returned_count: int
    total_amount: float
    approved_amount: float
    rejected_amount: float
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class ReportDetail(BaseModel):
    report: dict
    summary: dict
    items: List[dict]

    class Config:
        from_attributes = True


class RecalculateRequest(BaseModel):
    batch_nos: List[str] = Field(..., description="需要重新计算的批次号列表")
    operator: str = "system"


class RecalculateResponse(BaseModel):
    batch_nos: List[str]
    recalculated_count: int
    updated_summaries: List[dict]


class ExplanationLine(BaseModel):
    reconciliation_id: int
    emp_no: str
    emp_name: str
    anomaly_type: str
    explanation: str
    review_action: str
    review_comment: str

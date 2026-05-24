from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class OrderCreate(BaseModel):
    order_no: str
    user_id: str
    pile_no: str
    amount: float
    pay_time: Optional[datetime] = None
    pay_status: str = "unpaid"
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    raw_data: Optional[str] = None


class ElectricityRecordCreate(BaseModel):
    record_no: str
    order_no: str
    pile_no: str
    start_energy: float = 0
    end_energy: float = 0
    total_energy: float = 0
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    raw_data: Optional[str] = None


class VoucherCreate(BaseModel):
    voucher_no: str
    user_id: str
    amount: float
    valid_days: int = 30


class VoucherResponse(BaseModel):
    id: int
    voucher_no: str
    user_id: str
    amount: float
    valid_from: Optional[datetime]
    valid_to: Optional[datetime]
    status: str
    used_time: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class VoucherBindRequest(BaseModel):
    voucher_no: str
    case_no: str


class VoucherUseRequest(BaseModel):
    operator: Optional[str] = None
    remark: Optional[str] = None


class CompensationUploadRequest(BaseModel):
    batch_no: Optional[str] = None
    case_no: str
    user_id: str
    pile_no: str
    order_no: str
    electricity_record_no: Optional[str] = None
    fault_code: Optional[str] = None
    fault_description: Optional[str] = None
    description: Optional[str] = None
    order: Optional[OrderCreate] = None
    electricity: Optional[ElectricityRecordCreate] = None
    raw_input: Optional[Dict[str, Any]] = None


class CompensationSuggestion(BaseModel):
    should_compensate: bool
    reason: str
    suggested_amount: float
    fault_category: str
    conclusion: str
    risk_warnings: List[str] = []


class CompensationResponse(BaseModel):
    id: int
    batch_no: Optional[str]
    case_no: str
    user_id: str
    pile_no: str
    order_no: str
    fault_code: Optional[str]
    fault_category: Optional[str]
    description: Optional[str]
    status: str
    conclusion: Optional[str]
    suggestion: Optional[str]
    compensation_amount: float
    is_duplicate: bool
    operator: Optional[str]
    verified_at: Optional[datetime]
    confirmed_at: Optional[datetime]
    closed_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    suggestion_detail: Optional[CompensationSuggestion] = None
    voucher: Optional[VoucherResponse] = None

    class Config:
        from_attributes = True


class ConfirmRequest(BaseModel):
    operator: str
    approved: bool
    conclusion: Optional[str] = None
    compensation_amount: Optional[float] = None
    remark: Optional[str] = None


class RejudgeRequest(BaseModel):
    operator: str
    new_status: str
    conclusion: Optional[str] = None
    compensation_amount: Optional[float] = None
    remark: str


class OperationLogResponse(BaseModel):
    id: int
    operation: str
    old_status: Optional[str]
    new_status: Optional[str]
    operator: Optional[str]
    remark: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class QueryParams(BaseModel):
    case_no: Optional[str] = None
    user_id: Optional[str] = None
    pile_no: Optional[str] = None
    order_no: Optional[str] = None
    status: Optional[str] = None
    batch_no: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    page: int = 1
    page_size: int = 20

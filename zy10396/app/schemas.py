from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, validator

from app.models import AllocationStatus


class CallerBase(BaseModel):
    code: str = Field(..., max_length=50)
    name: str = Field(..., max_length=100)
    description: Optional[str] = None
    department: Optional[str] = None
    is_active: bool = True


class CallerCreate(CallerBase):
    pass


class CallerUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    department: Optional[str] = None
    is_active: Optional[bool] = None


class Caller(CallerBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ApiGroupBase(BaseModel):
    code: str = Field(..., max_length=50)
    name: str = Field(..., max_length=100)
    description: Optional[str] = None
    category: Optional[str] = None
    is_active: bool = True


class ApiGroupCreate(ApiGroupBase):
    pass


class ApiGroupUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    is_active: Optional[bool] = None


class ApiGroup(ApiGroupBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ResourcePriceBase(BaseModel):
    api_group_id: int
    unit_price: float = Field(..., gt=0)
    currency: str = "CNY"
    unit: str = "call"
    effective_date: datetime
    expiry_date: Optional[datetime] = None
    is_active: bool = True
    created_by: Optional[str] = None


class ResourcePriceCreate(ResourcePriceBase):
    pass


class ResourcePrice(ResourcePriceBase):
    id: int
    version: int
    created_at: datetime

    class Config:
        from_attributes = True


class CallRecordBase(BaseModel):
    caller_id: int
    api_group_id: int
    call_date: datetime
    call_count: int = Field(..., ge=0)
    success_count: int = 0
    fail_count: int = 0
    request_idempotency_key: Optional[str] = None

    @validator('fail_count')
    def check_counts(cls, v, values):
        if 'call_count' in values and v > values['call_count']:
            raise ValueError('fail_count cannot exceed call_count')
        if 'success_count' in values and values['success_count'] + v > values['call_count']:
            raise ValueError('success_count + fail_count cannot exceed call_count')
        return v


class CallRecordCreate(CallRecordBase):
    pass


class CallRecordBatchCreate(BaseModel):
    records: List[CallRecordCreate]
    idempotency_key: str


class CallRecord(CallRecordBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class AllocationRuleBase(BaseModel):
    name: str = Field(..., max_length=100)
    description: Optional[str] = None
    allocation_type: str = "proportional"
    formula: Optional[str] = None
    rounding_precision: int = 2
    effective_date: datetime
    expiry_date: Optional[datetime] = None
    is_active: bool = True
    created_by: Optional[str] = None


class AllocationRuleCreate(AllocationRuleBase):
    pass


class AllocationRule(AllocationRuleBase):
    id: int
    version: int
    created_at: datetime

    class Config:
        from_attributes = True


class AdjustmentRecordBase(BaseModel):
    adjustment_amount: float
    adjustment_type: str
    reason: str
    created_by: Optional[str] = None


class AdjustmentRecordCreate(AdjustmentRecordBase):
    pass


class AdjustmentRecord(AdjustmentRecordBase):
    id: int
    monthly_result_id: int
    previous_cost: float
    new_cost: float
    created_at: datetime

    class Config:
        from_attributes = True


class MonthlyResultBase(BaseModel):
    month: str = Field(..., pattern=r'^\d{4}-\d{2}$')
    caller_id: int
    api_group_id: int
    rule_id: int


class MonthlyResultCreate(MonthlyResultBase):
    idempotency_key: str


class MonthlyResultCalculate(BaseModel):
    month: str = Field(..., pattern=r'^\d{4}-\d{2}$')
    rule_id: int
    idempotency_key: str


class MonthlyResult(MonthlyResultBase):
    id: int
    rule_version: int
    total_calls: int
    unit_price: float
    raw_cost: float
    allocated_cost: float
    status: AllocationStatus
    failure_reason: Optional[str]
    created_at: datetime
    updated_at: datetime
    adjustments: List[AdjustmentRecord] = []

    class Config:
        from_attributes = True


class CostTrialCalculateRequest(BaseModel):
    month: str = Field(..., pattern=r'^\d{4}-\d{2}$')
    caller_id: Optional[int] = None
    api_group_id: Optional[int] = None
    rule_id: int


class TrialResultItem(BaseModel):
    caller_id: int
    caller_name: str
    api_group_id: int
    api_group_name: str
    total_calls: int
    unit_price: float
    raw_cost: float
    allocated_cost: float


class CostTrialResult(BaseModel):
    month: str
    rule_id: int
    rule_version: int
    total_cost: float
    items: List[TrialResultItem]


class ExportRequest(BaseModel):
    month: str = Field(..., pattern=r'^\d{4}-\d{2}$')
    idempotency_key: str
    format: str = "xlsx"


class ErrorResponse(BaseModel):
    error: str
    error_code: str
    details: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class SuccessResponse(BaseModel):
    success: bool = True
    message: str
    data: Optional[dict] = None


class HistoryQueryParams(BaseModel):
    month: Optional[str] = None
    caller_id: Optional[int] = None
    api_group_id: Optional[int] = None
    status: Optional[AllocationStatus] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    page: int = 1
    page_size: int = 50

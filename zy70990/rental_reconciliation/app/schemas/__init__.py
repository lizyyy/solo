from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from typing import List, Dict, Any


class OrderBase(BaseModel):
    order_no: str
    tenant_name: str
    tenant_phone: Optional[str] = None
    room_no: str
    check_in_date: datetime
    check_out_date: datetime
    rental_amount: float
    deposit_amount: float = 2000.0
    deposit_status: Optional[str] = "pending"


class OrderCreate(OrderBase):
    pass


class OrderResponse(OrderBase):
    id: str
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class OrderWithDetails(OrderResponse):
    meter_readings: List["MeterReadingResponse"] = []
    deductions: List["DeductionResponse"] = []
    deposit_records: List["DepositRecordResponse"] = []
    review_records: List["ReviewRecordResponse"] = []


class MeterReadingBase(BaseModel):
    meter_type: str
    initial_reading: float
    final_reading: float
    unit: str = "kWh"
    photo_url: Optional[str] = None
    reading_date: Optional[datetime] = None


class MeterReadingCreate(MeterReadingBase):
    pass


class MeterReadingResponse(MeterReadingBase):
    id: int
    order_id: str
    created_at: datetime

    class Config:
        from_attributes = True


class DeductionBase(BaseModel):
    deduction_type: str
    amount: float
    description: Optional[str] = None
    evidence_url: Optional[str] = None


class DeductionCreate(DeductionBase):
    pass


class DeductionResponse(DeductionBase):
    id: int
    order_id: str
    is_verified: bool = False
    verified_by: Optional[str] = None
    verified_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class DepositRecordBase(BaseModel):
    transaction_type: str
    amount: float
    balance: float
    reference_type: Optional[str] = None
    reference_id: Optional[str] = None
    operator: Optional[str] = None
    remark: Optional[str] = None


class DepositRecordCreate(DepositRecordBase):
    pass


class DepositRecordResponse(DepositRecordBase):
    id: int
    order_id: str
    created_at: datetime

    class Config:
        from_attributes = True


class ReviewRecordBase(BaseModel):
    review_type: str
    action: str
    before_value: Optional[Dict[str, Any]] = None
    after_value: Optional[Dict[str, Any]] = None
    reason: Optional[str] = None
    reviewer: Optional[str] = None


class ReviewRecordCreate(ReviewRecordBase):
    pass


class ReviewRecordResponse(ReviewRecordBase):
    id: int
    order_id: str
    created_at: datetime

    class Config:
        from_attributes = True


class ReconciliationReportBase(BaseModel):
    report_no: str
    order_id: str
    report_data: Dict[str, Any]
    summary: Dict[str, Any]
    status: str = "draft"
    generated_by: Optional[str] = None


class ReconciliationReportResponse(ReconciliationReportBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class ImportResult(BaseModel):
    success: bool
    message: str
    imported_count: int = 0
    errors: List[str] = []


class ElectricityCostDetail(BaseModel):
    meter_type: str
    initial_reading: float
    final_reading: float
    consumption: float
    unit: str
    tier1_usage: float
    tier1_cost: float
    tier2_usage: float
    tier2_cost: float
    tier3_usage: float
    tier3_cost: float
    total_cost: float


class WaterCostDetail(BaseModel):
    meter_type: str
    initial_reading: float
    final_reading: float
    consumption: float
    unit: str
    rate: float
    total_cost: float


class CostSummary(BaseModel):
    electricity_cost: float = 0.0
    water_cost: float = 0.0
    utility_total: float = 0.0
    deduction_total: float = 0.0
    deposit_refund: float = 0.0
    final_deposit_balance: float = 0.0


class DifferenceItem(BaseModel):
    field: str
    expected: float
    actual: float
    difference: float
    reason: str
    evidence: Optional[str] = None


class ReconciliationResult(BaseModel):
    order_id: str
    order_no: str
    cost_summary: CostSummary
    electricity_details: List[ElectricityCostDetail] = []
    water_details: List[WaterCostDetail] = []
    deductions: List[DeductionResponse] = []
    deposit_records: List[DepositRecordResponse] = []
    differences: List[DifferenceItem] = []
    is_balanced: bool = False
    needs_review: bool = False


class ReviewAction(BaseModel):
    action: str
    target_type: str
    target_id: Optional[int] = None
    new_value: Optional[Dict[str, Any]] = None
    reason: str
    reviewer: str
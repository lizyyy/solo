from datetime import date, datetime
from decimal import Decimal
from typing import Optional, List

from pydantic import BaseModel, Field

from app.models.enums import (
    ContractStatus,
    DeliveryStatus,
    AcceptanceResult,
    PaymentStatus,
    WarningLevel,
    WarningType,
    CompensationStatus,
    CompensationType,
)


class ContractBase(BaseModel):
    contract_no: str
    contract_name: str
    supplier_name: str
    total_amount: Decimal
    sign_date: date
    effective_date: date
    expiry_date: date
    late_delivery_rate: Decimal = Field(default=Decimal("0.001"), ge=0, le=1)
    quality_penalty_rate: Decimal = Field(default=Decimal("0.1"), ge=0, le=1)
    remarks: Optional[str] = None


class ContractCreate(ContractBase):
    pass


class ContractUpdate(BaseModel):
    contract_name: Optional[str] = None
    supplier_name: Optional[str] = None
    total_amount: Optional[Decimal] = None
    sign_date: Optional[date] = None
    effective_date: Optional[date] = None
    expiry_date: Optional[date] = None
    late_delivery_rate: Optional[Decimal] = None
    quality_penalty_rate: Optional[Decimal] = None
    status: Optional[ContractStatus] = None
    remarks: Optional[str] = None


class ContractResponse(ContractBase):
    id: int
    status: ContractStatus
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DeliveryPlanBase(BaseModel):
    batch_no: str
    plan_delivery_date: date
    plan_quantity: Decimal
    plan_amount: Decimal
    remarks: Optional[str] = None


class DeliveryPlanCreate(DeliveryPlanBase):
    contract_id: int


class DeliveryPlanUpdate(BaseModel):
    batch_no: Optional[str] = None
    plan_delivery_date: Optional[date] = None
    actual_delivery_date: Optional[date] = None
    plan_quantity: Optional[Decimal] = None
    plan_amount: Optional[Decimal] = None
    actual_quantity: Optional[Decimal] = None
    actual_amount: Optional[Decimal] = None
    status: Optional[DeliveryStatus] = None
    remarks: Optional[str] = None


class DeliveryPlanResponse(DeliveryPlanBase):
    id: int
    contract_id: int
    actual_delivery_date: Optional[date] = None
    actual_quantity: Optional[Decimal] = None
    actual_amount: Optional[Decimal] = None
    status: DeliveryStatus
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AcceptanceReceiptBase(BaseModel):
    delivery_plan_id: int
    receipt_no: str
    acceptance_date: date
    accepted_quantity: Decimal = Decimal("0")
    rejected_quantity: Decimal = Decimal("0")
    accepted_amount: Decimal = Decimal("0")
    rejected_amount: Decimal = Decimal("0")
    result: AcceptanceResult = AcceptanceResult.PENDING
    quality_issue_rate: Decimal = Decimal("0")
    rejection_reason: Optional[str] = None


class AcceptanceReceiptCreate(AcceptanceReceiptBase):
    pass


class AcceptanceReceiptUpdate(BaseModel):
    acceptance_date: Optional[date] = None
    accepted_quantity: Optional[Decimal] = None
    rejected_quantity: Optional[Decimal] = None
    accepted_amount: Optional[Decimal] = None
    rejected_amount: Optional[Decimal] = None
    result: Optional[AcceptanceResult] = None
    quality_issue_rate: Optional[Decimal] = None
    rejection_reason: Optional[str] = None


class AcceptanceReceiptResponse(AcceptanceReceiptBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PaymentNodeBase(BaseModel):
    node_name: str
    plan_payment_date: date
    plan_amount: Decimal
    payment_ratio: Decimal = Field(default=Decimal("0"), ge=0, le=1)
    remarks: Optional[str] = None


class PaymentNodeCreate(PaymentNodeBase):
    contract_id: int


class PaymentNodeUpdate(BaseModel):
    node_name: Optional[str] = None
    plan_payment_date: Optional[date] = None
    actual_payment_date: Optional[date] = None
    plan_amount: Optional[Decimal] = None
    actual_amount: Optional[Decimal] = None
    payment_ratio: Optional[Decimal] = None
    status: Optional[PaymentStatus] = None
    remarks: Optional[str] = None


class PaymentNodeResponse(PaymentNodeBase):
    id: int
    contract_id: int
    actual_payment_date: Optional[date] = None
    actual_amount: Optional[Decimal] = None
    status: PaymentStatus
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PenaltyRecordResponse(BaseModel):
    id: int
    contract_id: int
    delivery_plan_id: Optional[int]
    acceptance_id: Optional[int]
    penalty_type: str
    penalty_amount: Decimal
    base_amount: Decimal
    penalty_rate: Decimal
    late_days: Optional[int]
    calculation_details: str
    is_settled: bool
    created_at: datetime

    class Config:
        from_attributes = True


class WarningRecordResponse(BaseModel):
    id: int
    contract_id: int
    warning_type: WarningType
    warning_level: WarningLevel
    title: str
    description: str
    related_entity_type: Optional[str]
    related_entity_id: Optional[int]
    is_active: bool
    resolved_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class CompensationTaskResponse(BaseModel):
    id: int
    warning_id: Optional[int]
    contract_id: int
    task_type: CompensationType
    task_data: dict
    status: CompensationStatus
    retry_count: int
    max_retries: int
    error_message: Optional[str]
    last_run_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class WarningReportSummary(BaseModel):
    total_warnings: int
    active_warnings: int
    by_type: dict[str, int]
    by_level: dict[str, int]
    by_contract: dict[int, int]


class ContractFulfillmentDetail(BaseModel):
    contract: ContractResponse
    delivery_plans: List[DeliveryPlanResponse]
    payment_nodes: List[PaymentNodeResponse]
    penalties: List[PenaltyRecordResponse]
    warnings: List[WarningRecordResponse]
    total_penalty_amount: Decimal
    unsettled_penalty_amount: Decimal
    delivery_progress: Decimal
    payment_progress: Decimal


class FulfillmentRecordCreate(BaseModel):
    delivery_plan_id: int
    actual_delivery_date: date
    actual_quantity: Decimal
    actual_amount: Decimal

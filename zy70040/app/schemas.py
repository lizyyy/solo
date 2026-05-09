from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field

from app.models import PackageType, DepositStatus, RefundStatus


class PackageDepositInfo(BaseModel):
    type: str
    count: int
    deposit_per_unit: float
    total: float


class DepositOrderCreate(BaseModel):
    customer_id: str
    customer_name: str

    cycle_box_count: int = 0
    thermal_bag_count: int = 0
    pallet_count: int = 0

    cycle_box_deposit: float = 0.0
    thermal_bag_deposit: float = 0.0
    pallet_deposit: float = 0.0

    remark: Optional[str] = None
    operator_id: str
    operator_name: str


class DepositOrderResponse(BaseModel):
    id: int
    order_no: str
    customer_id: str
    customer_name: str

    cycle_box_count: int
    thermal_bag_count: int
    pallet_count: int

    cycle_box_deposit: float
    thermal_bag_deposit: float
    pallet_deposit: float
    total_deposit: float

    cycle_box_returned: int
    thermal_bag_returned: int
    pallet_returned: int

    cycle_box_damaged: int
    thermal_bag_damaged: int
    pallet_damaged: int

    cycle_box_deduction: float
    thermal_bag_deduction: float
    pallet_deduction: float
    total_deduction: float

    refunded_amount: float
    refundable_amount: float

    status: str
    remark: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ScanRecordCreate(BaseModel):
    deposit_order_no: str
    package_type: str
    package_code: str
    quantity: int = 1
    scan_time: Optional[datetime] = None
    remark: Optional[str] = None
    operator_id: str
    operator_name: str


class ScanRecordResponse(BaseModel):
    id: int
    scan_no: str
    deposit_order_id: int
    package_type: str
    package_code: str
    quantity: int
    operator_id: str
    operator_name: str
    is_reversed: bool
    reversed_at: Optional[datetime] = None
    reversed_by: Optional[str] = None
    reverse_reason: Optional[str] = None
    remark: Optional[str] = None
    scan_time: datetime
    created_at: datetime

    class Config:
        from_attributes = True


class DamageRecordCreate(BaseModel):
    deposit_order_no: str
    package_type: str
    package_code: str
    quantity: int = 1
    deduction_amount: float
    damage_level: Optional[str] = None
    damage_description: Optional[str] = None
    remark: Optional[str] = None
    operator_id: str
    operator_name: str


class DamageRecordResponse(BaseModel):
    id: int
    damage_no: str
    deposit_order_id: int
    package_type: str
    package_code: str
    quantity: int
    deduction_amount: float
    damage_level: Optional[str] = None
    damage_description: Optional[str] = None
    operator_id: str
    operator_name: str
    is_reversed: bool
    reversed_at: Optional[datetime] = None
    reversed_by: Optional[str] = None
    reverse_reason: Optional[str] = None
    remark: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class RefundOrderResponse(BaseModel):
    id: int
    refund_no: str
    deposit_order_id: int
    refund_amount: float
    cycle_box_refund: float
    thermal_bag_refund: float
    pallet_refund: float
    refund_method: Optional[str] = None
    transaction_id: Optional[str] = None
    status: str
    failed_reason: Optional[str] = None
    operator_id: str
    operator_name: str
    remark: Optional[str] = None
    created_at: datetime
    processed_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ReverseOperation(BaseModel):
    reason: str
    operator_id: str
    operator_name: str


class OperationHistoryResponse(BaseModel):
    id: int
    operation_type: str
    operation_desc: str
    entity_type: Optional[str] = None
    entity_id: Optional[int] = None
    entity_no: Optional[str] = None
    operator_id: str
    operator_name: str
    is_reverse: bool
    reverse_related_id: Optional[int] = None
    remark: Optional[str] = None
    operation_time: datetime

    class Config:
        from_attributes = True


class ReconciliationBatchResponse(BaseModel):
    id: int
    batch_no: str
    start_date: datetime
    end_date: datetime
    total_orders: int
    total_deposit: float
    total_refund: float
    total_deduction: float
    remaining_deposit: float
    scan_matched: int
    scan_unmatched: int
    refund_matched: int
    refund_unmatched: int
    operator_id: str
    operator_name: str
    remark: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class DepositOrderDetailResponse(DepositOrderResponse):
    scan_records: List[ScanRecordResponse] = []
    damage_records: List[DamageRecordResponse] = []
    refund_orders: List[RefundOrderResponse] = []

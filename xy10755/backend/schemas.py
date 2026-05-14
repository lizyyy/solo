from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List


class OrderLineCreate(BaseModel):
    sku: str
    product_name: str
    quantity: int
    unit_price: float
    original_input: Optional[str] = None


class OrderCreate(BaseModel):
    order_no: str
    customer_name: str
    customer_address: str
    order_lines: List[OrderLineCreate]
    raw_input: Optional[str] = None


class OrderResponse(BaseModel):
    id: int
    order_no: str
    customer_name: str
    customer_address: str
    status: str
    version: int
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        orm_mode = True


class OrderLineResponse(BaseModel):
    id: int
    order_id: int
    sku: str
    product_name: str
    quantity: int
    unit_price: float
    original_input: Optional[str]
    processed_result: Optional[str]
    status: str
    version: int
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        orm_mode = True


class FulfillmentRecordResponse(BaseModel):
    id: int
    order_id: int
    order_line_id: int
    warehouse_code: str
    warehouse_name: str
    sku: str
    quantity: int
    shipping_fee: float
    status: str
    shipping_rule_result: Optional[str]
    is_final: bool
    created_at: datetime
    processed_at: Optional[datetime]

    class Config:
        orm_mode = True


class WarehouseChangeLogResponse(BaseModel):
    id: int
    order_id: int
    order_line_id: int
    old_warehouse_code: Optional[str]
    new_warehouse_code: Optional[str]
    reason: Optional[str]
    processed_by: Optional[str]
    created_at: datetime

    class Config:
        orm_mode = True


class WarehouseResponse(BaseModel):
    id: int
    warehouse_code: str
    warehouse_name: str
    address: str
    city: str
    is_active: bool

    class Config:
        orm_mode = True


class InventoryResponse(BaseModel):
    id: int
    warehouse_id: int
    sku: str
    quantity: int
    reserved_quantity: int

    class Config:
        orm_mode = True


class SplitOrderRequest(BaseModel):
    order_no: str
    idempotency_key: str


class WarehouseChangeRequest(BaseModel):
    fulfillment_record_id: int
    new_warehouse_code: str
    reason: str
    processed_by: str


class ShippingRuleCorrectionRequest(BaseModel):
    fulfillment_record_id: int
    new_shipping_fee: float
    reason: str
    processed_by: str


class OrderDetailResponse(BaseModel):
    order: OrderResponse
    order_lines: List[OrderLineResponse]
    fulfillment_records: List[FulfillmentRecordResponse]
    warehouse_change_logs: List[WarehouseChangeLogResponse]

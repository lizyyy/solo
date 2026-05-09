from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field
from decimal import Decimal


PRICE_CHANGE_STATUSES = ["pending", "approving", "approved", "processing", "completed", "failed", "cancelled"]
TRANSFER_STATUSES = ["pending", "approving", "approved", "processing", "in_transit", "completed", "failed", "cancelled"]


class PriceChangeItem(BaseModel):
    product_id: int
    new_cost_price: Optional[Decimal] = Field(None, ge=0)
    new_sale_price: Optional[Decimal] = Field(None, ge=0)


class PriceChangeCreate(BaseModel):
    store_id: int
    items: List[PriceChangeItem] = Field(..., min_length=1)
    reason: Optional[str] = None
    effective_date: Optional[datetime] = None


class PriceChangeUpdate(BaseModel):
    reason: Optional[str] = None
    status: Optional[str] = Field(None, pattern="|".join(PRICE_CHANGE_STATUSES))


class PriceChangeHistoryResponse(BaseModel):
    id: int
    price_change_id: int
    from_status: Optional[str]
    to_status: str
    action: str
    note: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class PriceChangeResponse(BaseModel):
    id: int
    code: str
    store_id: int
    product_id: int
    old_cost_price: Decimal
    new_cost_price: Decimal
    old_sale_price: Decimal
    new_sale_price: Decimal
    reason: Optional[str]
    status: str
    retry_count: int
    max_retries: int
    error_message: Optional[str]
    executed_at: Optional[datetime]
    effective_date: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class TransferItem(BaseModel):
    product_id: int
    quantity: int = Field(..., gt=0)


class InventoryTransferCreate(BaseModel):
    source_store_id: int
    target_store_id: int
    items: List[TransferItem] = Field(..., min_length=1)
    reason: Optional[str] = None
    expected_arrival_date: Optional[datetime] = None


class InventoryTransferUpdate(BaseModel):
    reason: Optional[str] = None
    status: Optional[str] = Field(None, pattern="|".join(TRANSFER_STATUSES))


class TransferItemResponse(BaseModel):
    id: int
    transfer_id: int
    product_id: int
    quantity: int
    source_quantity_before: Optional[int]
    source_quantity_after: Optional[int]
    target_quantity_before: Optional[int]
    target_quantity_after: Optional[int]

    class Config:
        from_attributes = True


class InventoryTransferResponse(BaseModel):
    id: int
    code: str
    source_store_id: int
    target_store_id: int
    total_quantity: int
    reason: Optional[str]
    status: str
    retry_count: int
    max_retries: int
    error_message: Optional[str]
    executed_at: Optional[datetime]
    expected_arrival_date: Optional[datetime]
    is_compensating: bool
    created_at: datetime
    items: List[TransferItemResponse] = []

    class Config:
        from_attributes = True


class InventoryHistoryResponse(BaseModel):
    id: int
    inventory_id: int
    store_id: int
    product_id: int
    old_quantity: int
    new_quantity: int
    old_cost_price: Optional[Decimal]
    new_cost_price: Optional[Decimal]
    old_sale_price: Optional[Decimal]
    new_sale_price: Optional[Decimal]
    change_type: str
    reference_type: Optional[str]
    reference_id: Optional[int]
    note: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class FailedTaskResponse(BaseModel):
    id: int
    task_name: str
    task_type: str
    reference_type: Optional[str]
    reference_id: Optional[int]
    status: str
    retry_count: int
    max_retries: int
    last_error: Optional[str]
    last_failed_at: Optional[datetime]
    next_retry_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class AuditLogResponse(BaseModel):
    id: int
    user_id: Optional[int]
    username: Optional[str]
    action: str
    module: str
    resource_type: Optional[str]
    resource_id: Optional[int]
    method: Optional[str]
    path: Optional[str]
    ip_address: Optional[str]
    status: Optional[str]
    duration_ms: Optional[int]
    error_message: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class ImportExportLogResponse(BaseModel):
    id: int
    log_type: str
    module: str
    file_name: str
    file_size: Optional[int]
    total_rows: Optional[int]
    success_count: int
    failed_count: int
    skipped_count: int
    status: str
    started_at: Optional[datetime]
    completed_at: Optional[datetime]

    class Config:
        from_attributes = True

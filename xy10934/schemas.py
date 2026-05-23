from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class WaveBase(BaseModel):
    priority: Optional[int] = 1
    created_by: Optional[str] = None
    remarks: Optional[str] = None


class WaveCreate(WaveBase):
    order_ids: List[int] = Field(..., description="要合并到波次的订单ID列表")


class WaveUpdate(BaseModel):
    status: Optional[str] = None
    priority: Optional[int] = None
    remarks: Optional[str] = None


class WaveResponse(WaveBase):
    id: int
    wave_code: str
    status: str
    total_orders: int
    total_skus: int
    total_qty: int
    picked_qty: int
    reviewed_qty: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class OrderItemBase(BaseModel):
    sku: str
    sku_name: Optional[str] = None
    qty: int = 1
    price: float = 0


class OrderItemCreate(OrderItemBase):
    pass


class OrderItemResponse(OrderItemBase):
    id: int
    order_id: int
    picked_qty: int
    reviewed_qty: int
    location_code: Optional[str] = None
    is_out_of_stock: bool

    class Config:
        from_attributes = True


class OrderBase(BaseModel):
    order_no: str
    customer: Optional[str] = None
    address: Optional[str] = None
    total_amount: Optional[float] = 0


class OrderCreate(OrderBase):
    items: List[OrderItemCreate]


class OrderResponse(OrderBase):
    id: int
    wave_id: Optional[int] = None
    status: str
    total_qty: int
    is_split: bool
    parent_order_id: Optional[int] = None
    split_reason: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    order_items: List[OrderItemResponse] = []

    class Config:
        from_attributes = True


class LocationBase(BaseModel):
    location_code: str
    zone: Optional[str] = None
    aisle: Optional[str] = None
    shelf: Optional[str] = None
    level: Optional[str] = None
    position: Optional[str] = None
    sort_order: int = 0
    sku: Optional[str] = None
    sku_name: Optional[str] = None
    stock_qty: int = 0


class LocationCreate(LocationBase):
    pass


class LocationResponse(LocationBase):
    id: int
    is_active: bool
    reserved_qty: int

    class Config:
        from_attributes = True


class PickTaskResponse(BaseModel):
    id: int
    task_code: str
    wave_id: int
    order_id: int
    sku: str
    sku_name: Optional[str] = None
    location_code: str
    required_qty: int
    picked_qty: int
    status: str
    picker: Optional[str] = None
    picked_at: Optional[datetime] = None
    is_split: bool
    split_from_task_id: Optional[int] = None
    split_reason: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class PickTaskUpdate(BaseModel):
    picked_qty: Optional[int] = None
    status: Optional[str] = None
    picker: Optional[str] = None


class ReviewDiffBase(BaseModel):
    expected_qty: int
    actual_qty: int
    diff_type: str
    remarks: Optional[str] = None


class ReviewDiffCreate(ReviewDiffBase):
    wave_id: int
    order_id: int
    pick_task_id: int
    sku: str
    reviewer: Optional[str] = None


class ReviewDiffResponse(ReviewDiffBase):
    id: int
    diff_code: str
    wave_id: int
    order_id: int
    pick_task_id: int
    sku: str
    diff_qty: int
    status: str
    reviewer: Optional[str] = None
    reviewed_at: datetime
    resolved_at: Optional[datetime] = None
    resolver: Optional[str] = None
    resolution: Optional[str] = None

    class Config:
        from_attributes = True


class ReviewDiffResolve(BaseModel):
    resolution: str
    resolver: Optional[str] = None


class CompletionReportResponse(BaseModel):
    id: int
    report_code: str
    wave_id: int
    total_orders: int
    completed_orders: int
    total_tasks: int
    completed_tasks: int
    total_qty: int
    picked_qty: int
    reviewed_qty: int
    diff_count: int
    resolved_diff_count: int
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    duration_seconds: int
    generated_by: Optional[str] = None
    generated_at: datetime
    remarks: Optional[str] = None

    class Config:
        from_attributes = True


class ExceptionLogResponse(BaseModel):
    id: int
    exception_code: str
    wave_id: Optional[int] = None
    order_id: Optional[int] = None
    pick_task_id: Optional[int] = None
    operation: str
    input_data: str
    error_message: str
    conclusion: Optional[str] = None
    handled_by: Optional[str] = None
    handled_at: Optional[datetime] = None
    is_handled: bool
    created_at: datetime
    remarks: Optional[str] = None

    class Config:
        from_attributes = True


class ExceptionLogHandle(BaseModel):
    conclusion: str
    handled_by: Optional[str] = None
    remarks: Optional[str] = None


class WaveDetailResponse(WaveResponse):
    orders: List[OrderResponse] = []
    pick_tasks: List[PickTaskResponse] = []
    review_diffs: List[ReviewDiffResponse] = []
    completion_report: Optional[CompletionReportResponse] = None


class StockSplitRequest(BaseModel):
    pick_task_id: int
    available_qty: int
    reason: str
    operator: Optional[str] = None


class ManualCorrectionRequest(BaseModel):
    pick_task_id: int
    new_qty: int
    reason: str
    operator: Optional[str] = None

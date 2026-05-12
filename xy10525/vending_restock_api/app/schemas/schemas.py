from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, date
from app.models.models import TaskStatus, RouteStatus, FaultStatus


class MachineBase(BaseModel):
    id: str
    name: str
    location: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    max_slots: int = 20
    is_active: bool = True


class MachineCreate(MachineBase):
    pass


class MachineResponse(MachineBase):
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ProductBase(BaseModel):
    id: str
    name: str
    sku: str
    category: Optional[str] = None
    unit_volume: int = 1


class ProductCreate(ProductBase):
    pass


class ProductResponse(ProductBase):
    created_at: datetime

    class Config:
        from_attributes = True


class InventoryBase(BaseModel):
    machine_id: str
    product_id: str
    quantity: int
    min_level: int
    max_level: int
    expiry_date: Optional[datetime] = None


class InventoryCreate(InventoryBase):
    pass


class InventoryResponse(InventoryBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TaskItemBase(BaseModel):
    product_id: str
    item_type: str
    requested_quantity: int
    actual_quantity: Optional[int] = None
    notes: Optional[str] = None


class TaskItemCreate(TaskItemBase):
    pass


class TaskItemResponse(TaskItemBase):
    id: int
    task_id: str
    created_at: datetime

    class Config:
        from_attributes = True


class TaskHistoryBase(BaseModel):
    status_from: Optional[str] = None
    status_to: str
    operator: Optional[str] = None
    diff_before: Optional[str] = None
    diff_after: Optional[str] = None
    reason: Optional[str] = None


class TaskHistoryResponse(TaskHistoryBase):
    id: int
    task_id: str
    created_at: datetime

    class Config:
        from_attributes = True


class RestockTaskBase(BaseModel):
    id: str
    machine_id: str
    priority: int = 0
    notes: Optional[str] = None
    assigned_operator: Optional[str] = None


class RestockTaskCreate(RestockTaskBase):
    items: List[TaskItemCreate]


class RestockTaskUpdate(BaseModel):
    status: Optional[TaskStatus] = None
    notes: Optional[str] = None
    assigned_operator: Optional[str] = None
    items: Optional[List[TaskItemBase]] = None


class RestockTaskResponse(RestockTaskBase):
    route_id: Optional[str] = None
    status: TaskStatus
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    failed_reason: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    items: List[TaskItemResponse] = []
    history: List[TaskHistoryResponse] = []

    class Config:
        from_attributes = True


class RouteHistoryResponse(BaseModel):
    id: int
    route_id: str
    status_from: Optional[str] = None
    status_to: str
    operator: Optional[str] = None
    diff_before: Optional[str] = None
    diff_after: Optional[str] = None
    reason: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class RouteBase(BaseModel):
    id: str
    name: str
    total_capacity: int
    operator: Optional[str] = None
    vehicle_id: Optional[str] = None
    scheduled_date: datetime


class RouteCreate(RouteBase):
    task_ids: Optional[List[str]] = None


class RouteUpdate(BaseModel):
    status: Optional[RouteStatus] = None
    operator: Optional[str] = None
    vehicle_id: Optional[str] = None
    scheduled_date: Optional[datetime] = None


class RouteResponse(RouteBase):
    status: RouteStatus
    used_capacity: int
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    tasks: List[RestockTaskResponse] = []
    history: List[RouteHistoryResponse] = []

    class Config:
        from_attributes = True


class FaultBase(BaseModel):
    id: str
    machine_id: str
    fault_type: str
    description: str
    priority: int = 1
    assigned_operator: Optional[str] = None


class FaultCreate(FaultBase):
    pass


class FaultUpdate(BaseModel):
    status: Optional[FaultStatus] = None
    description: Optional[str] = None
    priority: Optional[int] = None
    assigned_operator: Optional[str] = None
    resolution_notes: Optional[str] = None


class FaultResponse(FaultBase):
    status: FaultStatus
    reported_at: datetime
    resolved_at: Optional[datetime] = None
    resolution_notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SalesForecastBase(BaseModel):
    machine_id: str
    product_id: str
    forecast_date: datetime
    predicted_quantity: int


class SalesForecastCreate(SalesForecastBase):
    pass


class SalesForecastResponse(SalesForecastBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class RestockDemand(BaseModel):
    machine_id: str
    product_id: str
    current_quantity: int
    max_level: int
    shortage: int
    reason: str
    expiry_date: Optional[datetime] = None


class RestockAnalysis(BaseModel):
    machine_id: str
    machine_name: str
    location: str
    demands: List[RestockDemand] = []
    total_shortage: int
    has_fault: bool = False
    active_fault: Optional[FaultResponse] = None
    pending_tasks_count: int


class RouteDetail(BaseModel):
    route_id: str
    route_name: str
    status: RouteStatus
    total_capacity: int
    used_capacity: int
    remaining_capacity: int
    operator: Optional[str] = None
    scheduled_date: datetime
    tasks: List[Dict[str, Any]] = []


class StockoutRisk(BaseModel):
    machine_id: str
    machine_name: str
    product_id: str
    product_name: str
    current_quantity: int
    min_level: int
    shortage: int
    predicted_demand: Optional[int] = None
    risk_level: str


class RecoveryItem(BaseModel):
    machine_id: str
    machine_name: str
    product_id: str
    product_name: str
    quantity: int
    expiry_date: datetime
    days_until_expiry: int


class ExecutionDiff(BaseModel):
    task_id: str
    machine_id: str
    item_type: str
    product_id: str
    requested_quantity: int
    actual_quantity: int
    difference: int


class DailyReport(BaseModel):
    report_date: date
    total_routes: int
    completed_routes: int
    total_tasks: int
    completed_tasks: int
    total_quantity_restocked: int
    total_quantity_recovered: int
    stockout_risks: List[StockoutRisk] = []
    recovery_items: List[RecoveryItem] = []
    execution_diffs: List[ExecutionDiff] = []
    unresolved_faults: List[FaultResponse] = []


class ErrorResponse(BaseModel):
    code: str
    message: str
    details: Optional[Dict[str, Any]] = None


class ManualCorrection(BaseModel):
    operator: str
    reason: str
    changes: Dict[str, Any]


class IdempotentRequest(BaseModel):
    idempotent_key: str

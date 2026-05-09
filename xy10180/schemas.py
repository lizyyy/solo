from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import date, datetime
from models import RuleType, MaintenanceStatus


class DeviceCreate(BaseModel):
    name: str
    model: Optional[str] = None
    serial_number: str
    total_hours: Optional[float] = 0.0
    total_count: Optional[int] = 0


class DeviceUpdate(BaseModel):
    name: Optional[str] = None
    total_hours: Optional[float] = None
    total_count: Optional[int] = None


class DeviceResponse(BaseModel):
    id: int
    name: str
    model: Optional[str]
    serial_number: str
    total_hours: float
    total_count: int
    created_at: datetime
    last_updated: datetime

    class Config:
        from_attributes = True


class RulePartCreate(BaseModel):
    part_name: str
    part_code: Optional[str] = None
    quantity: int = 1


class RulePartResponse(BaseModel):
    id: int
    part_name: str
    part_code: Optional[str]
    quantity: int

    class Config:
        from_attributes = True


class MaintenanceRuleCreate(BaseModel):
    device_id: int
    name: str
    rule_type: RuleType
    threshold_value: float
    description: Optional[str] = None
    parts: Optional[List[RulePartCreate]] = None


class MaintenanceRuleResponse(BaseModel):
    id: int
    device_id: int
    name: str
    rule_type: RuleType
    threshold_value: float
    description: Optional[str]
    is_active: int
    parts: List[RulePartResponse] = []

    class Config:
        from_attributes = True


class OrderPartResponse(BaseModel):
    id: int
    part_name: str
    part_code: Optional[str]
    quantity: int
    is_reserved: int

    class Config:
        from_attributes = True


class MaintenanceHistoryResponse(BaseModel):
    id: int
    action: str
    from_status: Optional[MaintenanceStatus]
    to_status: Optional[MaintenanceStatus]
    note: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class MaintenanceOrderResponse(BaseModel):
    id: int
    device_id: int
    rule_id: Optional[int]
    order_no: str
    trigger_type: RuleType
    trigger_value: float
    scheduled_date: Optional[date]
    due_date: Optional[date]
    original_due_date: Optional[date]
    status: MaintenanceStatus
    description: Optional[str]
    completion_note: Optional[str]
    created_at: datetime
    completed_at: Optional[datetime]
    delay_count: int
    parts: List[OrderPartResponse] = []
    history: List[MaintenanceHistoryResponse] = []

    class Config:
        from_attributes = True


class CheckMaintenanceRequest(BaseModel):
    device_id: int
    current_hours: Optional[float] = None
    current_count: Optional[int] = None
    check_date: Optional[date] = None


class TriggerMaintenanceRequest(BaseModel):
    device_id: int
    rule_id: int
    trigger_value: float
    due_date: Optional[date] = None
    description: Optional[str] = None


class UpdateOrderStatusRequest(BaseModel):
    status: MaintenanceStatus
    note: Optional[str] = None
    completion_note: Optional[str] = None


class DelayOrderRequest(BaseModel):
    new_due_date: date
    reason: Optional[str] = None


class ReportQuery(BaseModel):
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    device_id: Optional[int] = None
    status: Optional[MaintenanceStatus] = None


class InventoryCreate(BaseModel):
    part_code: str
    part_name: str
    total_quantity: int = 0


class InventoryResponse(BaseModel):
    id: int
    part_code: str
    part_name: str
    total_quantity: int
    reserved_quantity: int
    available_quantity: int

    class Config:
        from_attributes = True

    @classmethod
    def from_orm(cls, obj):
        return cls(
            id=obj.id,
            part_code=obj.part_code,
            part_name=obj.part_name,
            total_quantity=obj.total_quantity,
            reserved_quantity=obj.reserved_quantity,
            available_quantity=obj.total_quantity - obj.reserved_quantity
        )


class MaintenanceReport(BaseModel):
    total_orders: int
    pending_count: int
    in_progress_count: int
    completed_count: int
    delayed_count: int
    cancelled_count: int
    avg_completion_days: Optional[float]
    devices_needing_maintenance: List[dict] = []

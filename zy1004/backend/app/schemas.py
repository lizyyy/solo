from pydantic import BaseModel, Field, validator
from typing import Optional, List
from datetime import datetime
from enum import Enum

class OrderStatus(str, Enum):
    PENDING_CONFIRM = "待确认"
    CONFIRMED = "已预约"
    IN_PROGRESS = "维修中"
    AWAITING_PICKUP = "待取件"
    COMPLETED = "已完成"
    CANCELLED = "已取消"

class DeviceType(str, Enum):
    RICE_COOKER = "电饭煲"
    AIR_FRYER = "空气炸锅"
    COFFEE_MACHINE = "咖啡机"
    REFRIGERATOR = "冰箱"
    WASHING_MACHINE = "洗衣机"
    MICROWAVE = "微波炉"
    OVEN = "烤箱"
    DISHWASHER = "洗碗机"
    OTHER = "其他"

STATUS_TRANSITIONS = {
    "待确认": ["已预约", "已取消"],
    "已预约": ["维修中", "已取消"],
    "维修中": ["待取件", "已取消"],
    "待取件": ["已完成", "已取消"],
    "已完成": [],
    "已取消": [],
}

def can_transition(from_status: str, to_status: str) -> bool:
    return to_status in STATUS_TRANSITIONS.get(from_status, [])

class TechnicianBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)
    is_active: Optional[bool] = True

class TechnicianCreate(TechnicianBase):
    pass

class TechnicianUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)
    is_active: Optional[bool] = None

class Technician(TechnicianBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class SparePartBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    sku: Optional[str] = Field(None, max_length=50)
    category: Optional[str] = Field(None, max_length=100)
    stock_quantity: Optional[int] = Field(0, ge=0)
    min_stock: Optional[int] = Field(5, ge=0)
    unit_price: Optional[float] = Field(0.0, ge=0)
    unit: Optional[str] = "个"
    description: Optional[str] = None

class SparePartCreate(SparePartBase):
    pass

class SparePartUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    sku: Optional[str] = Field(None, max_length=50)
    category: Optional[str] = Field(None, max_length=100)
    stock_quantity: Optional[int] = Field(None, ge=0)
    min_stock: Optional[int] = Field(None, ge=0)
    unit_price: Optional[float] = Field(None, ge=0)
    unit: Optional[str] = None
    description: Optional[str] = None

class SparePart(SparePartBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class SparePartConsume(BaseModel):
    spare_part_id: int
    quantity: int = Field(..., gt=0)

class SparePartStockAdjust(BaseModel):
    quantity: int = Field(..., gt=0)
    notes: Optional[str] = None

class RepairOrderBase(BaseModel):
    customer_name: str = Field(..., min_length=1, max_length=100)
    customer_phone: str = Field(..., min_length=1, max_length=20)
    customer_address: Optional[str] = None
    device_type: str
    device_brand: Optional[str] = Field(None, max_length=100)
    device_model: Optional[str] = Field(None, max_length=100)
    fault_description: str = Field(..., min_length=1)
    estimated_cost: Optional[float] = Field(0.0, ge=0)
    appointment_type: Optional[str] = "到店"
    appointment_time: Optional[datetime] = None
    technician_id: Optional[int] = None
    notes: Optional[str] = None

class RepairOrderCreate(RepairOrderBase):
    pass

class RepairOrderUpdate(BaseModel):
    customer_name: Optional[str] = Field(None, min_length=1, max_length=100)
    customer_phone: Optional[str] = Field(None, min_length=1, max_length=20)
    customer_address: Optional[str] = None
    device_type: Optional[str] = None
    device_brand: Optional[str] = Field(None, max_length=100)
    device_model: Optional[str] = Field(None, max_length=100)
    fault_description: Optional[str] = Field(None, min_length=1)
    estimated_cost: Optional[float] = Field(None, ge=0)
    final_cost: Optional[float] = Field(None, ge=0)
    discount: Optional[float] = Field(None, ge=0)
    appointment_type: Optional[str] = None
    appointment_time: Optional[datetime] = None
    technician_id: Optional[int] = None
    notes: Optional[str] = None

class StatusUpdate(BaseModel):
    status: OrderStatus
    reason: Optional[str] = None

class CostAdjustment(BaseModel):
    final_cost: Optional[float] = Field(None, ge=0)
    discount: Optional[float] = Field(None, ge=0)
    reason: Optional[str] = None

class CommunicationLogBase(BaseModel):
    content: str = Field(..., min_length=1)

class CommunicationLogCreate(CommunicationLogBase):
    pass

class CommunicationLog(CommunicationLogBase):
    id: int
    repair_order_id: int
    created_at: datetime

    class Config:
        from_attributes = True

class StatusHistory(BaseModel):
    id: int
    repair_order_id: int
    from_status: Optional[str]
    to_status: str
    reason: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

class InventoryTransaction(BaseModel):
    id: int
    spare_part_id: int
    repair_order_id: Optional[int]
    transaction_type: str
    quantity: int
    unit_price: float
    notes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

class RepairOrder(RepairOrderBase):
    id: int
    order_no: str
    final_cost: float
    discount: float
    is_paid: bool
    paid_at: Optional[datetime]
    status: str
    arrival_time: Optional[datetime]
    start_repair_time: Optional[datetime]
    complete_time: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    technician: Optional[Technician] = None
    communication_logs: Optional[List[CommunicationLog]] = None
    status_histories: Optional[List[StatusHistory]] = None
    inventory_transactions: Optional[List[InventoryTransaction]] = None

    class Config:
        from_attributes = True

class DashboardStats(BaseModel):
    today_appointments: int
    overdue_orders: int
    low_stock_items: int
    last_7_days_income: float

class BackupData(BaseModel):
    technicians: List[dict]
    spare_parts: List[dict]
    repair_orders: List[dict]
    communication_logs: List[dict]
    status_histories: List[dict]
    inventory_transactions: List[dict]

class BackupResult(BaseModel):
    success: bool
    message: str
    validated: Optional[int] = None
    imported: Optional[int] = None
    errors: Optional[List[str]] = None

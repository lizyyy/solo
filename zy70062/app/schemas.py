from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List


class DeviceCategoryBase(BaseModel):
    code: str
    name: str
    description: Optional[str] = None
    priority_weight: int = 1


class DeviceCategoryResponse(DeviceCategoryBase):
    id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class RepairOrderCreate(BaseModel):
    classroom: str = Field(..., description="教室位置，如：教学楼A-301")
    device_category_code: str = Field(..., description="设备分类编码")
    reported_by: str = Field(..., description="报修人")
    reporter_phone: Optional[str] = None
    fault_description: str = Field(..., description="故障描述")
    fault_level: str = Field(default="normal", description="故障等级：critical/urgent/normal/low")


class RepairOrderResponse(BaseModel):
    id: int
    order_no: str
    classroom: str
    device_category_code: str
    device_category_name: str
    reported_by: str
    reporter_phone: Optional[str]
    fault_description: str
    fault_level: str
    priority: int
    status: str
    assigned_to: Optional[str]
    assigned_at: Optional[datetime]
    completed_at: Optional[datetime]
    accepted_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class RepairOrderDetailResponse(RepairOrderResponse):
    status_logs: List["StatusLogResponse"] = []
    spare_usage: List["SpareUsageResponse"] = []
    acceptance: Optional["AcceptanceResponse"] = None


class StatusLogResponse(BaseModel):
    id: int
    from_status: Optional[str]
    to_status: str
    operator: str
    remark: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class AssignRequest(BaseModel):
    assigned_to: str = Field(..., description="维修人员")


class CompleteRequest(BaseModel):
    completed_by: str = Field(..., description="完成人")
    solution: str = Field(..., description="维修解决方案")


class AcceptRequest(BaseModel):
    accepted_by: str = Field(..., description="验收人")
    result: str = Field(..., description="验收结果：passed/failed")
    comment: Optional[str] = None


class SpareUsageCreate(BaseModel):
    spare_part_code: str = Field(..., description="备件编码")
    quantity: int = Field(..., gt=0, description="使用数量")
    used_by: str = Field(..., description="使用人")
    remark: Optional[str] = None


class SparePartResponse(BaseModel):
    id: int
    code: str
    name: str
    model: Optional[str]
    unit: str
    stock_quantity: int
    unit_price: float

    class Config:
        from_attributes = True


class SpareUsageResponse(BaseModel):
    id: int
    spare_part_code: str
    spare_part_name: str
    quantity: int
    unit: str
    unit_price: float
    total_price: float
    used_by: str
    remark: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class RepairWorkerResponse(BaseModel):
    id: int
    name: str
    phone: Optional[str]
    specialty_category: Optional[str]
    is_available: bool
    current_load: int

    class Config:
        from_attributes = True


class AcceptanceResponse(BaseModel):
    id: int
    result: str
    accepted_by: str
    comment: Optional[str]
    solution_summary: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class CampusStatsResponse(BaseModel):
    total_orders: int = 0
    pending_orders: int = 0
    processing_orders: int = 0
    completed_orders: int = 0
    accepted_orders: int = 0
    total_spare_cost: float = 0.0
    avg_completion_hours: float = 0.0
    category_stats: List[dict] = []
    classroom_top_issues: List[dict] = []


class OperationResponse(BaseModel):
    success: bool
    message: str
    data: Optional[dict] = None
    advice: Optional[str] = None

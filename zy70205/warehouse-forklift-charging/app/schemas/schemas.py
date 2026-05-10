from pydantic import BaseModel, Field, validator
from datetime import datetime
from typing import Optional, List
from app.models.models import (
    ForkliftStatus, ChargingStationStatus, ChargingStatus, 
    TaskPriority, TaskStatus
)

class APIResponse(BaseModel):
    success: bool
    code: str
    message: str
    data: Optional[dict] = None
    errors: Optional[List[dict]] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class ForkliftCreate(BaseModel):
    forklift_code: str = Field(..., min_length=2, max_length=50, description="叉车编号")
    name: str = Field(..., min_length=1, max_length=100, description="叉车名称")
    battery_capacity: float = Field(..., gt=0, description="电池容量（kWh）")
    min_operating_percent: float = Field(20.0, ge=0, le=100, description="最低运行电量")
    charging_rate: float = Field(10.0, gt=0, description="充电速率（kWh/小时）")

class ForkliftUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    status: Optional[ForkliftStatus] = None
    min_operating_percent: Optional[float] = Field(None, ge=0, le=100)
    charging_rate: Optional[float] = Field(None, gt=0)

class ForkliftResponse(BaseModel):
    id: int
    forklift_code: str
    name: str
    status: ForkliftStatus
    battery_capacity: float
    min_operating_percent: float
    charging_rate: float
    created_at: datetime
    is_deleted: bool

    class Config:
        from_attributes = True

class ChargingStationCreate(BaseModel):
    station_code: str = Field(..., min_length=2, max_length=50, description="充电位编号")
    name: str = Field(..., min_length=1, max_length=100, description="充电位名称")
    charging_power: float = Field(50.0, gt=0, description="充电桩功率（kW）")

class ChargingStationUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[ChargingStationStatus] = None
    charging_power: Optional[float] = Field(None, gt=0)

class ChargingStationResponse(BaseModel):
    id: int
    station_code: str
    name: str
    status: ChargingStationStatus
    charging_power: float
    current_forklift_id: Optional[int]
    lock_expires_at: Optional[datetime]

    class Config:
        from_attributes = True

class BatteryStatusResponse(BaseModel):
    forklift_id: int
    current_percent: float
    last_update_time: datetime
    estimated_full_charge_time: Optional[datetime]
    health_percent: float

    class Config:
        from_attributes = True

class TaskCreate(BaseModel):
    task_code: str = Field(..., min_length=2, max_length=50)
    forklift_code: str = Field(..., description="叉车编号")
    priority: TaskPriority = Field(TaskPriority.MEDIUM)
    estimated_duration_hours: float = Field(..., gt=0, description="预计执行时长（小时）")
    required_battery_percent: float = Field(..., ge=0, le=100, description="任务所需电量")
    scheduled_start_time: datetime
    scheduled_end_time: datetime
    description: Optional[str] = None

    @validator('scheduled_end_time')
    def validate_time_range(cls, v, values):
        if 'scheduled_start_time' in values and v <= values['scheduled_start_time']:
            raise ValueError('scheduled_end_time must be after scheduled_start_time')
        return v

class TaskResponse(BaseModel):
    id: int
    task_code: str
    forklift_id: int
    priority: TaskPriority
    status: TaskStatus
    estimated_duration_hours: float
    required_battery_percent: float
    scheduled_start_time: datetime
    scheduled_end_time: datetime
    description: Optional[str]

    class Config:
        from_attributes = True

class ChargingRequestCreate(BaseModel):
    forklift_code: str = Field(..., description="叉车编号")
    station_code: Optional[str] = Field(None, description="指定充电位（可选，不指定则自动分配）")
    target_percent: float = Field(100.0, ge=0, le=100, description="目标充电百分比")
    request_source: str = Field("auto", description="请求来源：auto/manual")
    request_idempotency_key: Optional[str] = Field(None, description="幂等键，用于防止重复提交")

class ChargingRequestResponse(BaseModel):
    id: int
    request_code: str
    forklift_id: int
    station_id: Optional[int]
    status: ChargingStatus
    target_percent: float
    start_percent: float
    queue_position: Optional[int]
    priority_score: float
    estimated_completion_time: Optional[datetime]
    request_source: str

    class Config:
        from_attributes = True

class BatteryPredictionRequest(BaseModel):
    forklift_code: str = Field(..., description="叉车编号")
    current_percent: float = Field(..., ge=0, le=100, description="当前电量")
    target_percent: float = Field(100.0, ge=0, le=100, description="目标电量")
    station_code: Optional[str] = Field(None, description="充电位编号")

class BatteryPredictionResponse(BaseModel):
    forklift_code: str
    current_percent: float
    target_percent: float
    estimated_charging_hours: float
    estimated_completion_time: datetime
    charging_rate_kwh: float
    energy_required_kwh: float
    validation_result: str
    validation_details: dict

class QueueStatusResponse(BaseModel):
    total_queued: int
    available_stations: int
    queue: List[dict]

class ManualCorrectionRequest(BaseModel):
    entity_type: str = Field(..., description="修正类型：forklift/station/battery/task/request")
    entity_id: int = Field(..., description="实体ID")
    field_name: str = Field(..., description="要修正的字段")
    old_value: str = Field(..., description="原始值（用于验证）")
    new_value: str = Field(..., description="新值")
    reason: str = Field(..., min_length=5, description="修正原因")
    operator: str = Field("manual", description="操作人")

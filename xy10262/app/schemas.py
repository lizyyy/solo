from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List
from app.constants import QueueStatus, InspectionPriority, RiskLevel


class VehicleQueueCreate(BaseModel):
    plate_number: str = Field(..., min_length=2, max_length=20, description="车牌号")
    cargo_type: str = Field(..., min_length=1, max_length=50, description="货物类型")
    target_temp_low: float = Field(..., description="目标温度下限(℃)")
    target_temp_high: float = Field(..., description="目标温度上限(℃)")
    risk_level: Optional[RiskLevel] = Field(default=None, description="风险等级(自动判定可忽略)")
    remark: Optional[str] = Field(default=None, description="备注")


class VehicleQueueUpdateStatus(BaseModel):
    status: QueueStatus = Field(..., description="目标状态")
    remark: Optional[str] = Field(default=None, description="状态变更备注")


class TemperatureRecordCreate(BaseModel):
    vehicle_id: int = Field(..., description="车辆ID")
    temperature: float = Field(..., description="温度(℃)")
    record_time: datetime = Field(..., description="记录时间")
    remark: Optional[str] = Field(default=None, description="备注")


class TemperatureRecordManualUpdate(BaseModel):
    new_temperature: float = Field(..., description="新温度(℃)")
    modified_by: str = Field(..., min_length=1, description="修改人")
    reason: str = Field(..., min_length=1, description="修改原因")


class InspectionCreate(BaseModel):
    vehicle_id: int = Field(..., description="车辆ID")
    inspector: Optional[str] = Field(default=None, description="查验员")


class InspectionComplete(BaseModel):
    inspection_result: str = Field(..., description="查验结果: passed/detained")
    issues_found: Optional[str] = Field(default=None, description="发现问题")
    check_points: Optional[str] = Field(default=None, description="检查要点")


class VehicleQueueResponse(BaseModel):
    id: int
    plate_number: str
    queue_number: int
    cargo_type: str
    risk_level: str
    status: str
    inspection_priority: str
    target_temp_low: float
    target_temp_high: float
    entry_time: datetime
    exit_time: Optional[datetime] = None
    remark: Optional[str] = None

    class Config:
        from_attributes = True


class TemperatureRecordResponse(BaseModel):
    id: int
    vehicle_id: int
    temperature: float
    record_time: datetime
    is_normal: bool
    anomaly_type: Optional[str] = None
    is_manual_modified: bool
    modified_by: Optional[str] = None
    original_temperature: Optional[float] = None
    created_at: datetime
    remark: Optional[str] = None

    class Config:
        from_attributes = True


class InspectionRecordResponse(BaseModel):
    id: int
    vehicle_id: int
    inspector: Optional[str] = None
    inspection_result: Optional[str] = None
    check_points: Optional[str] = None
    issues_found: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class VehicleDetailResponse(VehicleQueueResponse):
    temperature_records: List[TemperatureRecordResponse] = []
    inspection_records: List[InspectionRecordResponse] = []


class ErrorResponse(BaseModel):
    code: str
    message: str
    details: dict = {}

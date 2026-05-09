from pydantic import BaseModel, Field
from datetime import datetime, date
from typing import Optional, List, Dict, Any
from enum import Enum

class PlanStatus(str, Enum):
    DRAFT = "draft"
    PENDING = "pending"
    APPROVED = "approved"
    EXECUTING = "executing"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    MANUALLY_CORRECTED = "manually_corrected"

class OperationType(str, Enum):
    CHARGE = "charge"
    DISCHARGE = "discharge"
    IDLE = "idle"

class EquipmentStatus(str, Enum):
    AVAILABLE = "available"
    MAINTENANCE = "maintenance"
    FAULT = "fault"
    LIMITED = "limited"

class AlertLevel(str, Enum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"

class PriceWindowCreate(BaseModel):
    start_time: datetime
    end_time: datetime
    price_per_kwh: float = Field(gt=0, description="电价（元/kWh）")
    window_type: str = Field(description="电价窗口类型：峰谷平尖等")
    is_charge_window: bool = Field(default=False, description="是否为充电窗口（低价时段）")
    is_discharge_window: bool = Field(default=False, description="是否为放电窗口（高价时段）")

class PriceWindowResponse(BaseModel):
    id: int
    start_time: datetime
    end_time: datetime
    price_per_kwh: float
    window_type: str
    is_charge_window: bool
    is_discharge_window: bool
    created_at: datetime

    class Config:
        from_attributes = True

class SOCConstraintCreate(BaseModel):
    plan_date: date
    min_soc: float = Field(ge=0, le=100, description="最小 SOC 限制（%）")
    max_soc: float = Field(ge=0, le=100, description="最大 SOC 限制（%）")
    initial_soc: float = Field(ge=0, le=100, description="初始 SOC（%）")
    target_soc: Optional[float] = Field(None, ge=0, le=100, description="目标 SOC（%）")
    station_id: str = Field(description="电站 ID")

class SOCConstraintResponse(BaseModel):
    id: int
    plan_date: date
    min_soc: float
    max_soc: float
    initial_soc: float
    target_soc: Optional[float]
    station_id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class PlanSegmentCreate(BaseModel):
    start_time: datetime
    end_time: datetime
    operation_type: OperationType
    power_kw: float = Field(description="充放电功率（kW），正值充电，负值放电")
    energy_kwh: float = Field(description="充放电电量（kWh）")
    expected_soc: float = Field(ge=0, le=100, description="该时段结束时预期 SOC")
    price_window_id: Optional[int] = None

class PlanSegmentResponse(BaseModel):
    id: int
    start_time: datetime
    end_time: datetime
    operation_type: OperationType
    power_kw: float
    energy_kwh: float
    expected_soc: float
    price_window_id: Optional[int]

    class Config:
        from_attributes = True

class ChargePlanCreate(BaseModel):
    station_id: str = Field(description="储能电站 ID")
    plan_date: date
    plan_name: str
    description: Optional[str] = None
    soc_constraint_id: int
    segments: List[PlanSegmentCreate]
    load_forecast_data: Optional[Dict[str, Any]] = None

class ChargePlanResponse(BaseModel):
    id: int
    station_id: str
    plan_date: date
    plan_name: str
    description: Optional[str]
    version: int
    status: PlanStatus
    soc_constraint_id: int
    created_by: Optional[str]
    created_at: datetime
    updated_at: datetime
    segments: List[PlanSegmentResponse] = []

    class Config:
        from_attributes = True

class PlanVersionResponse(BaseModel):
    id: int
    plan_id: int
    version_number: int
    status: PlanStatus
    change_reason: Optional[str]
    changed_by: Optional[str]
    created_at: datetime
    snapshot_data: Optional[Dict[str, Any]]

    class Config:
        from_attributes = True

class ExecutionReceiptCreate(BaseModel):
    plan_id: int
    segment_id: int
    actual_start_time: datetime
    actual_end_time: datetime
    actual_power_kw: float
    actual_energy_kwh: float
    actual_soc: float
    equipment_status: EquipmentStatus
    remarks: Optional[str] = None

class ExecutionReceiptResponse(BaseModel):
    id: int
    plan_id: int
    segment_id: int
    actual_start_time: datetime
    actual_end_time: datetime
    actual_power_kw: float
    actual_energy_kwh: float
    actual_soc: float
    equipment_status: EquipmentStatus
    remarks: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

class DeviationAlertResponse(BaseModel):
    id: int
    plan_id: int
    segment_id: Optional[int]
    alert_type: str
    alert_level: AlertLevel
    message: str
    deviation_value: Optional[float]
    threshold_value: Optional[float]
    is_resolved: bool
    resolved_by: Optional[str]
    resolved_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True

class RevenueReportResponse(BaseModel):
    id: int
    plan_id: int
    station_id: str
    report_date: date
    total_charge_kwh: float
    total_discharge_kwh: float
    charge_cost: float
    discharge_revenue: float
    net_profit: float
    efficiency_rate: float
    deviation_rate: float
    created_at: datetime

    class Config:
        from_attributes = True

class ManualCorrectionCreate(BaseModel):
    plan_id: int
    target_status: PlanStatus
    reason: str
    corrected_by: str
    correction_data: Optional[Dict[str, Any]] = None

class PlanHistoryResponse(BaseModel):
    id: int
    plan_id: int
    action: str
    old_status: Optional[PlanStatus]
    new_status: PlanStatus
    operator: Optional[str]
    reason: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

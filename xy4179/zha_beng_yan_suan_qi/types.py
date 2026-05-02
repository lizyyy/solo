"""数据类型定义模块。"""

from datetime import datetime
from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, field_validator


class AlertLevel(str, Enum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


class AlertType(str, Enum):
    OVERTOPPING = "overtopping"
    BACKFLOW = "backflow"
    PUMP_CYCLE = "pump_cycle"
    ENERGY_LIMIT = "energy_limit"
    DATA_GAP = "data_gap"


class PumpState(str, Enum):
    OFF = "off"
    ON = "on"
    STARTING = "starting"
    STOPPING = "stopping"


class GateState(BaseModel):
    gate_id: str
    opening: float
    max_opening: float
    min_opening: float


class PumpStateTimeline(BaseModel):
    pump_id: str
    state: PumpState
    start_time: datetime
    duration_hours: float = 0.0


class SiteConfig(BaseModel):
    site_name: str
    site_id: str
    river_name: str
    
    inner_channel_area: float
    inner_channel_capacity: float
    inner_warning_level: float
    inner_critical_level: float
    
    outer_river_name: Optional[str] = None
    outer_warning_level: Optional[float] = None
    outer_critical_level: Optional[float] = None
    
    pumps: List[Dict[str, Any]] = Field(default_factory=list)
    gates: List[Dict[str, Any]] = Field(default_factory=list)
    
    min_pump_cycle_hours: float = 2.0
    daily_energy_limit_kwh: Optional[float] = None
    
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    @field_validator('min_pump_cycle_hours')
    @classmethod
    def validate_min_cycle(cls, v: float) -> float:
        if v < 0:
            raise ValueError("最小停机间隔不能为负数")
        return v
    
    @field_validator('inner_channel_area', 'inner_channel_capacity')
    @classmethod
    def validate_positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("河道面积和库容必须为正数")
        return v


class WaterLevelRecord(BaseModel):
    timestamp: datetime
    inner_level: float
    outer_level: Optional[float] = None
    
    @field_validator('inner_level')
    @classmethod
    def validate_inner_level(cls, v: float) -> float:
        if v < 0:
            raise ValueError("水位不能为负数")
        return v


class RainfallRecord(BaseModel):
    timestamp: datetime
    rainfall_mm: float
    duration_hours: float = 1.0
    
    @field_validator('rainfall_mm')
    @classmethod
    def validate_rainfall(cls, v: float) -> float:
        if v < 0:
            raise ValueError("降雨量不能为负数")
        return v


class PumpCurve(BaseModel):
    pump_id: str
    pump_name: str
    head_m: List[float]
    flow_m3h: List[float]
    power_kw: List[float]
    rated_flow_m3h: float
    rated_head_m: float
    rated_power_kw: float
    min_start_head_m: Optional[float] = None
    max_start_head_m: Optional[float] = None


class GateLimit(BaseModel):
    gate_id: str
    gate_name: str
    max_opening: float
    min_opening: float
    discharge_coefficient: float
    width_m: float
    sill_elevation: float


class SimulationState(BaseModel):
    timestamp: datetime
    inner_level: float
    outer_level: Optional[float]
    storage_m3: float
    inflow_m3h: float
    pump_total_flow_m3h: float
    gate_total_flow_m3h: float
    net_flow_m3h: float
    
    pump_states: Dict[str, PumpState]
    gate_openings: Dict[str, float]
    
    rainfall_mm: float = 0.0
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class Alert(BaseModel):
    alert_type: AlertType
    level: AlertLevel
    message: str
    timestamp: Optional[datetime] = None
    details: Dict[str, Any] = Field(default_factory=dict)
    
    class Config:
        use_enum_values = True


class SimulationResult(BaseModel):
    site_name: str
    simulation_start: datetime
    simulation_end: datetime
    step_hours: float
    
    states: List[SimulationState]
    alerts: List[Alert]
    
    total_pump_runtime_hours: Dict[str, float] = Field(default_factory=dict)
    total_energy_kwh: float = 0.0
    max_inner_level: float = 0.0
    min_inner_level: float = float('inf')
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class ImportedData(BaseModel):
    water_levels: List[WaterLevelRecord]
    rainfalls: List[RainfallRecord]
    pump_curves: List[PumpCurve]
    gate_limits: List[GateLimit]
    
    data_start: Optional[datetime] = None
    data_end: Optional[datetime] = None

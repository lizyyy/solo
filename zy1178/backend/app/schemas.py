from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum

class Point(BaseModel):
    x: float
    y: float

class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    location: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    location: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class ProjectResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    location: Optional[str]
    latitude: Optional[float]
    longitude: Optional[float]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class RoofCreate(BaseModel):
    project_id: int
    name: Optional[str] = "主屋顶"
    coordinates: List[Point]
    area: float
    inclination: Optional[float] = 0
    azimuth: Optional[float] = 0

class RoofResponse(BaseModel):
    id: int
    project_id: int
    name: str
    coordinates: List[Point]
    area: float
    inclination: float
    azimuth: float
    created_at: datetime
    
    class Config:
        from_attributes = True

class ObstacleCreate(BaseModel):
    project_id: int
    name: Optional[str] = "障碍物"
    coordinates: List[Point]
    height: float
    type: Optional[str] = "unknown"

class ObstacleResponse(BaseModel):
    id: int
    project_id: int
    name: str
    coordinates: List[Point]
    height: float
    type: str
    created_at: datetime
    
    class Config:
        from_attributes = True

class PanelCreate(BaseModel):
    project_id: int
    model: Optional[str] = "标准组件"
    power: float
    efficiency: float
    width: float
    height: float
    temperature_coefficient: Optional[float] = -0.38
    lifetime: Optional[int] = 25
    degradation_rate: Optional[float] = 0.5

class PanelResponse(BaseModel):
    id: int
    project_id: int
    model: str
    power: float
    efficiency: float
    width: float
    height: float
    temperature_coefficient: float
    lifetime: int
    degradation_rate: float
    created_at: datetime
    
    class Config:
        from_attributes = True

class HourlyDataCreate(BaseModel):
    project_id: int
    timestamp: datetime
    global_irradiance: float
    direct_irradiance: Optional[float] = None
    diffuse_irradiance: Optional[float] = None
    temperature: Optional[float] = None
    wind_speed: Optional[float] = None
    electricity_price: float
    feed_in_tariff: Optional[float] = None

class HourlyDataResponse(BaseModel):
    id: int
    project_id: int
    timestamp: datetime
    global_irradiance: float
    direct_irradiance: Optional[float]
    diffuse_irradiance: Optional[float]
    temperature: Optional[float]
    wind_speed: Optional[float]
    electricity_price: float
    feed_in_tariff: Optional[float]
    created_at: datetime
    
    class Config:
        from_attributes = True

class LayoutCreate(BaseModel):
    project_id: int
    name: Optional[str] = "方案1"
    panel_positions: List[Dict[str, Any]]
    panel_count: int
    total_power: float
    is_active: Optional[bool] = False

class LayoutResponse(BaseModel):
    id: int
    project_id: int
    name: str
    panel_positions: List[Dict[str, Any]]
    panel_count: int
    total_power: float
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

class CalculationResultResponse(BaseModel):
    id: int
    project_id: int
    layout_id: int
    shading_map: Optional[Dict[str, Any]]
    shading_hours: float
    shading_loss_ratio: float
    installable_capacity: float
    actual_capacity: float
    annual_generation: float
    monthly_generation: Optional[List[float]]
    annual_revenue: float
    monthly_revenue: Optional[List[float]]
    initial_investment: Optional[float]
    payback_period: Optional[float]
    net_present_value: Optional[float]
    internal_rate_of_return: Optional[float]
    risk_factors: Optional[List[Dict[str, Any]]]
    created_at: datetime
    
    class Config:
        from_attributes = True

class RiskFactor(BaseModel):
    type: str
    severity: str
    description: str
    suggestion: Optional[str] = None

class ExportFormat(str, Enum):
    markdown = "markdown"
    json = "json"

class ExportRequest(BaseModel):
    project_id: int
    layout_ids: List[int]
    format: ExportFormat = ExportFormat.markdown
    include_charts: Optional[bool] = True

class CalculationRequest(BaseModel):
    project_id: int
    layout_id: int
    investment_per_kw: Optional[float] = 4.5
    discount_rate: Optional[float] = 0.05

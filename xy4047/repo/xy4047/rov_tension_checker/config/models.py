from typing import List, Optional
from pydantic import BaseModel, Field, field_validator
from datetime import datetime


class CableSpec(BaseModel):
    name: str = Field(..., description="缆线规格名称")
    diameter: float = Field(..., gt=0, description="缆线直径 (m)")
    weight_in_air: float = Field(..., gt=0, description="空气中重量 (N/m)")
    weight_in_water: float = Field(..., gt=0, description="水中重量 (N/m)")
    max_allowable_tension: float = Field(..., gt=0, description="最大允许张力 (N)")
    min_bending_radius: float = Field(..., gt=0, description="最小弯曲半径 (m)")
    safety_factor: float = Field(default=1.5, gt=1.0, description="安全系数")
    
    @property
    def working_tension_limit(self) -> float:
        return self.max_allowable_tension / self.safety_factor


class ROVSpec(BaseModel):
    name: str = Field(..., description="ROV 型号")
    weight_in_air: float = Field(..., gt=0, description="空气中重量 (N)")
    weight_in_water: float = Field(..., description="水中重量 (N)，负表示正浮力")
    maximum_thrust_horizontal: float = Field(..., gt=0, description="最大水平推力 (N)")
    maximum_thrust_vertical: float = Field(..., gt=0, description="最大垂直推力 (N)")


class CurrentLayer(BaseModel):
    depth_from: float = Field(..., ge=0, description="层深度起始 (m)")
    depth_to: float = Field(..., ge=0, description="层深度结束 (m)")
    speed: float = Field(..., ge=0, description="海流速度 (m/s)")
    direction: float = Field(..., ge=0, lt=360, description="海流方向 (度，0=北)")
    
    @field_validator('depth_to')
    @classmethod
    def check_depth_order(cls, v: float, info) -> float:
        if info.data.get('depth_from') is not None and v < info.data['depth_from']:
            raise ValueError('depth_to 必须大于等于 depth_from')
        return v


class ProtectionFrame(BaseModel):
    pipeline_id: str = Field(..., description="管线编号")
    latitude: float = Field(..., ge=-90, le=90, description="纬度")
    longitude: float = Field(..., ge=-180, le=180, description="经度")
    local_x: Optional[float] = Field(None, description="局部坐标 X (m)")
    local_y: Optional[float] = Field(None, description="局部坐标 Y (m)")
    collision_radius: float = Field(default=5.0, gt=0, description="擦碰预警半径 (m)")


class ProjectConfig(BaseModel):
    project_name: str = Field(..., description="项目名称")
    pipeline_id: str = Field(..., description="管线编号")
    survey_date: datetime = Field(..., description="作业日期")
    
    cable_spec: CableSpec
    rov_spec: ROVSpec
    current_layers: List[CurrentLayer] = Field(default_factory=list, description="海流层配置")
    protection_frames: List[ProtectionFrame] = Field(default_factory=list, description="管线保护架列表")
    
    sampling_time_step: float = Field(default=1.0, gt=0, description="采样时间步长 (秒)")
    output_directory: str = Field(default="./output", description="输出目录")
    quarantine_directory: str = Field(default="./quarantine", description="隔离目录")
    data_directory: str = Field(default="./data", description="数据目录")
    
    risk_thresholds: "RiskThresholds" = Field(default_factory=lambda: RiskThresholds())
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class RiskThresholds(BaseModel):
    tension_warning_ratio: float = Field(default=0.8, ge=0, le=1.0, description="张力预警比例")
    tension_critical_ratio: float = Field(default=0.95, ge=0, le=1.0, description="张力临界比例")
    bending_radius_warning_ratio: float = Field(default=1.2, ge=1.0, description="弯曲半径预警倍率")
    bending_radius_critical_ratio: float = Field(default=1.05, ge=1.0, description="弯曲半径临界倍率")
    angle_change_warning: float = Field(default=15.0, gt=0, description="角度突变预警 (度/秒)")
    angle_change_critical: float = Field(default=30.0, gt=0, description="角度突变临界 (度/秒)")
    current_change_warning: float = Field(default=0.3, gt=0, description="海流突变预警 (m/s)")
    current_change_critical: float = Field(default=0.6, gt=0, description="海流突变临界 (m/s)")
    slack_cable_tension: float = Field(default=50.0, gt=0, description="缆线松弛判定张力 (N)")

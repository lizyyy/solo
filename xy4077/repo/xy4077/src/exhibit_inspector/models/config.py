"""运输配置和阈值设置模型"""

from datetime import timedelta
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class TransportPhase(str, Enum):
    """运输阶段类型"""
    LOADING = "loading"
    TRANSPORT = "transport"
    UNLOADING = "unloading"
    OPENING = "opening"
    INSPECTION = "inspection"
    STORAGE = "storage"


class TimeWindow(BaseModel):
    """时间窗口"""
    start_time: str = Field(..., description="开始时间，ISO 格式")
    end_time: str = Field(..., description="结束时间，ISO 格式")
    phase: TransportPhase = Field(..., description="运输阶段")
    description: Optional[str] = Field(None, description="描述")


class ThresholdSettings(BaseModel):
    """阈值设置"""
    shock_threshold_g: float = Field(2.0, ge=0.1, description="震动阈值，单位 g")
    shock_duration_minutes: float = Field(0.5, ge=0, description="震动持续时间阈值，分钟")
    temp_max_celsius: float = Field(25.0, description="最高温度阈值，摄氏度")
    temp_min_celsius: float = Field(15.0, description="最低温度阈值，摄氏度")
    temp_duration_minutes: float = Field(10.0, ge=0, description="超温持续时间阈值，分钟")
    humidity_max_pct: float = Field(70.0, ge=0, le=100, description="最高湿度阈值，百分比")
    humidity_min_pct: float = Field(40.0, ge=0, le=100, description="最低湿度阈值，百分比")
    humidity_duration_minutes: float = Field(10.0, ge=0, description="超湿持续时间阈值，分钟")
    sample_interval_seconds: float = Field(60.0, ge=1, description="采样间隔，秒")
    max_missing_samples: int = Field(3, ge=0, description="允许的最大连续缺采样数")


class TransportConfig(BaseModel):
    """运输配置"""
    shipment_id: str = Field(..., description="运输批次编号")
    shipment_name: str = Field(..., description="运输批次名称")
    origin: str = Field(..., description="始发地")
    destination: str = Field(..., description="目的地")
    carrier: str = Field(..., description="承运方")
    transport_mode: str = Field("road", description="运输方式: road, air, rail")
    planned_start_time: Optional[str] = Field(None, description="计划开始时间，ISO 格式")
    planned_end_time: Optional[str] = Field(None, description="计划结束时间，ISO 格式")
    time_windows: list[TimeWindow] = Field(default_factory=list, description="运输阶段时间窗口")
    thresholds: ThresholdSettings = Field(default_factory=ThresholdSettings, description="阈值设置")
    created_at: Optional[str] = Field(None, description="创建时间，ISO 格式")
    updated_at: Optional[str] = Field(None, description="更新时间，ISO 格式")

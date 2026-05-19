from datetime import datetime
from enum import Enum
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field, validator


class DeviceEventStatus(str, Enum):
    NORMAL = "normal"
    WARNING = "warning"
    ERROR = "error"
    UNKNOWN = "unknown"


class DeviceEvent(BaseModel):
    event_id: str = Field(..., description="事件唯一ID")
    device_id: str = Field(..., description="设备ID")
    station_id: str = Field(..., description="换电站ID")
    event_type: str = Field(..., description="事件类型")
    event_time: datetime = Field(..., description="事件发生时间")
    status: DeviceEventStatus = Field(default=DeviceEventStatus.UNKNOWN, description="事件状态")
    bay_number: Optional[int] = Field(None, description="仓号")
    battery_id: Optional[str] = Field(None, description="电池ID")
    user_id: Optional[str] = Field(None, description="用户ID")
    details: Dict[str, Any] = Field(default_factory=dict, description="事件详情")
    raw_data: Optional[str] = Field(None, description="原始数据")
    created_at: datetime = Field(default_factory=datetime.now)

    @validator("event_time", pre=True)
    def parse_event_time(cls, v):
        if isinstance(v, str):
            for fmt in ["%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y%m%d%H%M%S"]:
                try:
                    return datetime.strptime(v, fmt)
                except ValueError:
                    continue
        return v

    class Config:
        use_enum_values = True

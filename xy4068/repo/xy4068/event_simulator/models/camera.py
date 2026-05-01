from datetime import datetime
from typing import Dict, List, Optional
from pydantic import BaseModel, Field


class CameraStatus(str):
    ONLINE = "online"
    OFFLINE = "offline"
    DEGRADED = "degraded"


class Camera(BaseModel):
    id: str = Field(..., description="摄像头唯一标识")
    name: str = Field(..., description="摄像头名称")
    location: str = Field(..., description="安装位置，如 '门店入口'、'货架A区'")
    ip_address: Optional[str] = Field(None, description="IP地址")
    model: Optional[str] = Field(None, description="摄像头型号")
    resolution: Optional[str] = Field(None, description="分辨率，如 '1920x1080'")
    status: str = Field(default=CameraStatus.ONLINE, description="当前状态")
    areas: List[str] = Field(default_factory=list, description="监控区域ID列表")
    metadata: Dict[str, str] = Field(default_factory=dict, description="额外元数据")
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }
    
    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "location": self.location,
            "ip_address": self.ip_address,
            "model": self.model,
            "resolution": self.resolution,
            "status": self.status,
            "areas": self.areas,
            "metadata": self.metadata,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

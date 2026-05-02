from datetime import datetime
from typing import Dict, List, Optional
from pydantic import BaseModel, Field


class JitterType(str):
    NETWORK_DELAY = "network_delay"
    PACKET_LOSS = "packet_loss"
    OUT_OF_ORDER = "out_of_order"
    TIMESTAMP_DRIFT = "timestamp_drift"
    DUPLICATE = "duplicate"
    CAMERA_BLOCKED = "camera_blocked"


class JitterRule(BaseModel):
    id: str = Field(..., description="规则唯一标识")
    name: str = Field(..., description="规则名称")
    description: Optional[str] = Field(None, description="规则描述")
    jitter_type: str = Field(..., description="抖动类型")
    probability: float = Field(
        default=0.1, ge=0.0, le=1.0, description="触发概率 0.0-1.0"
    )
    severity: str = Field(default="medium", description="影响严重程度")
    
    delay_min_ms: Optional[int] = Field(
        None, description="NETWORK_DELAY: 最小延迟(ms)"
    )
    delay_max_ms: Optional[int] = Field(
        None, description="NETWORK_DELAY: 最大延迟(ms)"
    )
    
    loss_percentage: Optional[float] = Field(
        None, ge=0.0, le=1.0, description="PACKET_LOSS: 丢包百分比 0.0-1.0"
    )
    
    drift_seconds: Optional[int] = Field(
        None, description="TIMESTAMP_DRIFT: 时间戳漂移秒数（正负）"
    )
    
    duplicate_count: Optional[int] = Field(
        None, ge=1, description="DUPLICATE: 重复发送次数"
    )
    
    block_duration_seconds: Optional[int] = Field(
        None, description="CAMERA_BLOCKED: 遮挡持续秒数"
    )
    
    target_cameras: List[str] = Field(
        default_factory=list, description="目标摄像头ID列表，空表示所有"
    )
    target_event_types: List[str] = Field(
        default_factory=list, description="目标事件类型列表，空表示所有"
    )
    
    time_windows: List[Dict[str, int]] = Field(
        default_factory=list,
        description="生效时间窗口 [{ 'start_offset': 0, 'end_offset': 3600 }, ...]"
    )
    
    enabled: bool = Field(default=True, description="是否启用")
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
            "description": self.description,
            "jitter_type": self.jitter_type,
            "probability": self.probability,
            "severity": self.severity,
            "delay_min_ms": self.delay_min_ms,
            "delay_max_ms": self.delay_max_ms,
            "loss_percentage": self.loss_percentage,
            "drift_seconds": self.drift_seconds,
            "duplicate_count": self.duplicate_count,
            "block_duration_seconds": self.block_duration_seconds,
            "target_cameras": self.target_cameras,
            "target_event_types": self.target_event_types,
            "time_windows": self.time_windows,
            "enabled": self.enabled,
            "metadata": self.metadata,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
    
    def is_applicable(self, camera_id: str, event_type: str, event_offset: int) -> bool:
        if not self.enabled:
            return False
        if self.target_cameras and camera_id not in self.target_cameras:
            return False
        if self.target_event_types and event_type not in self.target_event_types:
            return False
        if self.time_windows:
            in_window = False
            for window in self.time_windows:
                start = window.get("start_offset", 0)
                end = window.get("end_offset", 999999999)
                if start <= event_offset <= end:
                    in_window = True
                    break
            if not in_window:
                return False
        return True

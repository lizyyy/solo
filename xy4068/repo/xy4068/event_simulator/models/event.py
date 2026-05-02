from datetime import datetime
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field


class EventType(str):
    PERSON_ENTER = "person_enter"
    PERSON_EXIT = "person_exit"
    PERSON_COUNT = "person_count"
    SHELF_OUT_OF_STOCK = "shelf_out_of_stock"
    SHELF_LOW_STOCK = "shelf_low_stock"
    OBSTRUCTION_DETECTED = "obstruction_detected"
    MOTION_DETECTED = "motion_detected"
    CAMERA_OFFLINE = "camera_offline"
    CAMERA_ONLINE = "camera_online"
    NETWORK_JITTER = "network_jitter"
    NETWORK_LOSS = "network_loss"
    FALSE_POSITIVE = "false_positive"
    CUSTOM = "custom"


class EventSeverity(str):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


class EventSource(str):
    CSV = "csv"
    JSON = "json"
    TEMPLATE = "template"
    MANUAL = "manual"


class Event(BaseModel):
    id: str = Field(..., description="事件唯一标识")
    event_type: str = Field(..., description="事件类型")
    timestamp: datetime = Field(..., description="事件发生时间")
    camera_id: str = Field(..., description="产生事件的摄像头ID")
    area_id: Optional[str] = Field(None, description="相关区域ID")
    severity: str = Field(default=EventSeverity.INFO, description="事件严重程度")
    source: str = Field(default=EventSource.MANUAL, description="事件来源")
    confidence: Optional[float] = Field(None, ge=0.0, le=1.0, description="算法置信度")
    payload: Dict[str, Any] = Field(default_factory=dict, description="事件详细数据")
    metadata: Dict[str, str] = Field(default_factory=dict, description="额外元数据")
    created_at: datetime = Field(default_factory=datetime.now)
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }
    
    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "event_type": self.event_type,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "camera_id": self.camera_id,
            "area_id": self.area_id,
            "severity": self.severity,
            "source": self.source,
            "confidence": self.confidence,
            "payload": self.payload,
            "metadata": self.metadata,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
    
    def get_footprint(self) -> str:
        return f"{self.timestamp.isoformat()}:{self.camera_id}:{self.event_type}:{self.area_id or 'none'}"

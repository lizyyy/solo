from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Union
from pydantic import BaseModel, Field


class RepeatPattern(str):
    ONCE = "once"
    DAILY = "daily"
    WEEKLY = "weekly"
    INTERVAL = "interval"


class EventTemplate(BaseModel):
    id: str = Field(..., description="模板唯一标识")
    name: str = Field(..., description="模板名称")
    description: Optional[str] = Field(None, description="模板描述")
    event_type: str = Field(..., description="生成的事件类型")
    camera_id: Optional[str] = Field(None, description="目标摄像头ID，为空则随机选择")
    area_id: Optional[str] = Field(None, description="目标区域ID，为空则随机选择")
    severity: str = Field(default="info", description="事件严重程度")
    confidence_range: Optional[Dict[str, float]] = Field(
        None, description="置信度范围 {'min': 0.5, 'max': 0.95}"
    )
    payload_template: Dict[str, Any] = Field(
        default_factory=dict, description="事件载荷模板，支持变量如 {count}, {timestamp}"
    )
    repeat_pattern: str = Field(default=RepeatPattern.ONCE, description="重复模式")
    repeat_interval: Optional[int] = Field(
        None, description="重复间隔（秒），仅当 pattern 为 interval 时有效"
    )
    repeat_count: Optional[int] = Field(
        None, description="重复次数，None 表示无限"
    )
    start_offset: int = Field(default=0, description="相对于场景开始的偏移秒数")
    end_offset: Optional[int] = Field(
        None, description="相对于场景开始的结束偏移秒数"
    )
    jitter_rules: List[str] = Field(
        default_factory=list, description="应用的抖动规则ID列表"
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
            "event_type": self.event_type,
            "camera_id": self.camera_id,
            "area_id": self.area_id,
            "severity": self.severity,
            "confidence_range": self.confidence_range,
            "payload_template": self.payload_template,
            "repeat_pattern": self.repeat_pattern,
            "repeat_interval": self.repeat_interval,
            "repeat_count": self.repeat_count,
            "start_offset": self.start_offset,
            "end_offset": self.end_offset,
            "jitter_rules": self.jitter_rules,
            "enabled": self.enabled,
            "metadata": self.metadata,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
    
    def calculate_event_times(self, scenario_start: datetime) -> List[datetime]:
        times = []
        if self.repeat_pattern == RepeatPattern.ONCE:
            times.append(scenario_start + timedelta(seconds=self.start_offset))
        elif self.repeat_pattern == RepeatPattern.INTERVAL and self.repeat_interval:
            current = scenario_start + timedelta(seconds=self.start_offset)
            end_time = None
            if self.end_offset:
                end_time = scenario_start + timedelta(seconds=self.end_offset)
            count = 0
            while True:
                if self.repeat_count is not None and count >= self.repeat_count:
                    break
                if end_time and current > end_time:
                    break
                times.append(current)
                current += timedelta(seconds=self.repeat_interval)
                count += 1
        return times

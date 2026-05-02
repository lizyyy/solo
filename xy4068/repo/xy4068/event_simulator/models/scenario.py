from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class ScenarioStatus(str):
    DRAFT = "draft"
    READY = "ready"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    VALIDATED = "validated"


class Scenario(BaseModel):
    id: str = Field(..., description="场景唯一标识")
    name: str = Field(..., description="场景名称")
    description: Optional[str] = Field(None, description="场景描述")
    version: str = Field(default="1.0.0", description="场景版本")
    
    status: str = Field(default=ScenarioStatus.DRAFT, description="场景状态")
    
    start_time: Optional[datetime] = Field(None, description="场景开始时间")
    end_time: Optional[datetime] = Field(None, description="场景结束时间")
    duration_seconds: Optional[int] = Field(None, description="预设持续时间（秒）")
    
    cameras: List[str] = Field(default_factory=list, description="包含的摄像头ID列表")
    areas: List[str] = Field(default_factory=list, description="包含的区域ID列表")
    event_templates: List[str] = Field(default_factory=list, description="使用的事件模板ID列表")
    jitter_rules: List[str] = Field(default_factory=list, description="应用的抖动规则ID列表")
    
    event_sources: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="事件数据源配置 [{'type': 'csv|json', 'path': '...', 'enabled': true}]"
    )
    
    tags: List[str] = Field(default_factory=list, description="场景标签")
    metadata: Dict[str, str] = Field(default_factory=dict, description="额外元数据")
    
    last_run_at: Optional[datetime] = Field(None, description="上次运行时间")
    run_count: int = Field(default=0, description="运行次数")
    
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
            "version": self.version,
            "status": self.status,
            "start_time": self.start_time.isoformat() if self.start_time else None,
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "duration_seconds": self.duration_seconds,
            "cameras": self.cameras,
            "areas": self.areas,
            "event_templates": self.event_templates,
            "jitter_rules": self.jitter_rules,
            "event_sources": self.event_sources,
            "tags": self.tags,
            "metadata": self.metadata,
            "last_run_at": self.last_run_at.isoformat() if self.last_run_at else None,
            "run_count": self.run_count,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

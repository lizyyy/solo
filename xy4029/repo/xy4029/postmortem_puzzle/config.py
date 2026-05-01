"""配置模型模块 - 定义项目配置和数据模型"""

import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

from pydantic import BaseModel, Field, field_validator


class LogTimeFormat(BaseModel):
    """日志时间格式配置"""
    name: str = Field(description="格式名称")
    format: str = Field(description="strftime格式字符串")
    regex: Optional[str] = Field(default=None, description="可选的正则表达式，用于提取时间戳")


class SensitivityRule(BaseModel):
    """敏感字段脱敏规则"""
    name: str = Field(description="规则名称")
    pattern: str = Field(description="正则表达式模式")
    replacement: str = Field(default="***", description="替换字符串")
    field_names: Optional[List[str]] = Field(default=None, description="可选的字段名列表，如果指定则只在这些字段中应用")


class ProjectConfig(BaseModel):
    """项目配置模型"""
    project_name: str = Field(description="项目名称")
    default_timezone: str = Field(default="Asia/Shanghai", description="默认时区")
    services: List[str] = Field(default_factory=list, description="服务名称列表")
    environments: List[str] = Field(default_factory=lambda: ["production", "staging", "development"], description="环境列表")
    
    deduplication_window_seconds: int = Field(default=300, description="告警去重窗口（秒）")
    clock_offset_seconds: int = Field(default=0, description="设备时钟偏移（秒），正数表示设备时间比实际时间快")
    
    log_time_formats: List[LogTimeFormat] = Field(default_factory=lambda: [
        LogTimeFormat(name="ISO8601", format="%Y-%m-%dT%H:%M:%S%z"),
        LogTimeFormat(name="ISO8601_UTC", format="%Y-%m-%dT%H:%M:%SZ"),
        LogTimeFormat(name="Common", format="%Y-%m-%d %H:%M:%S"),
        LogTimeFormat(name="RFC3339", format="%Y-%m-%d %H:%M:%S%z"),
    ])
    
    sensitivity_rules: List[SensitivityRule] = Field(default_factory=lambda: [
        SensitivityRule(
            name="password",
            pattern=r'(?i)(password|passwd|pwd)["\s:=]+["\']?[^\s"\',}]+["\']?',
            replacement='\\1: "***"',
        ),
        SensitivityRule(
            name="token",
            pattern=r'(?i)(token|secret|key|api[_-]?key|access[_-]?token)["\s:=]+["\']?[^\s"\',}]+["\']?',
            replacement='\\1: "***"',
        ),
        SensitivityRule(
            name="ip_address",
            pattern=r'\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b',
            replacement='***.***.***.***',
        ),
        SensitivityRule(
            name="email",
            pattern=r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}',
            replacement='***@***.***',
        ),
    ])
    
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    
    @field_validator('default_timezone')
    @classmethod
    def validate_timezone(cls, v: str) -> str:
        import pytz
        try:
            pytz.timezone(v)
            return v
        except pytz.exceptions.UnknownTimeZoneError:
            raise ValueError(f"Unknown timezone: {v}")
    
    @field_validator('deduplication_window_seconds')
    @classmethod
    def validate_deduplication_window(cls, v: int) -> int:
        if v < 0:
            raise ValueError("deduplication_window_seconds must be non-negative")
        return v
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        data = self.model_dump()
        data['created_at'] = self.created_at.isoformat()
        data['updated_at'] = self.updated_at.isoformat()
        return data
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'ProjectConfig':
        """从字典加载"""
        if 'created_at' in data and isinstance(data['created_at'], str):
            data['created_at'] = datetime.fromisoformat(data['created_at'])
        if 'updated_at' in data and isinstance(data['updated_at'], str):
            data['updated_at'] = datetime.fromisoformat(data['updated_at'])
        return cls(**data)
    
    def save(self, path: Path) -> None:
        """保存到文件"""
        self.updated_at = datetime.now()
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(self.to_dict(), f, indent=2, ensure_ascii=False)
    
    @classmethod
    def load(cls, path: Path) -> 'ProjectConfig':
        """从文件加载"""
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return cls.from_dict(data)


class EventType:
    """事件类型常量"""
    ALERT_TRIGGER = "alert_trigger"  # 告警触发
    ALERT_RECOVER = "alert_recover"  # 告警恢复
    HUMAN_CONFIRM = "human_confirm"  # 人工确认
    CHANGE_OPERATION = "change_operation"  # 变更操作
    ERROR_SURGE = "error_surge"  # 错误日志激增
    RECOVERY_VERIFY = "recovery_verify"  # 恢复验证
    TODO_ITEM = "todo_item"  # 复盘待办
    UNKNOWN = "unknown"  # 未知


class EventSource:
    """事件来源常量"""
    ALERTS_CSV = "alerts_csv"  # 监控告警CSV
    CHAT_MARKDOWN = "chat_markdown"  # 值班群Markdown
    CHAT_JSON = "chat_json"  # 值班群JSON
    LOGS = "logs"  # 服务日志
    MANUAL = "manual"  # 人工补充


class Event(BaseModel):
    """事件模型 - 表示时间线上的一个事件"""
    id: str = Field(description="事件唯一ID")
    timestamp: datetime = Field(description="事件时间戳（已标准化为UTC）")
    original_timestamp: Optional[str] = Field(default=None, description="原始时间戳字符串")
    event_type: str = Field(default=EventType.UNKNOWN, description="事件类型")
    source: str = Field(description="事件来源")
    source_file: Optional[str] = Field(default=None, description="来源文件名")
    
    service: Optional[str] = Field(default=None, description="相关服务")
    environment: Optional[str] = Field(default=None, description="环境")
    severity: Optional[str] = Field(default=None, description="严重级别")
    
    title: str = Field(description="事件标题")
    description: Optional[str] = Field(default=None, description="详细描述")
    raw_content: Optional[str] = Field(default=None, description="原始内容（用于审计）")
    
    tags: List[str] = Field(default_factory=list, description="标签列表")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="元数据")
    
    is_duplicate: bool = Field(default=False, description="是否为重复事件")
    duplicate_of: Optional[str] = Field(default=None, description="重复事件的ID")
    
    quarantine_reason: Optional[str] = Field(default=None, description="隔离原因（如果被隔离）")
    is_quarantined: bool = Field(default=False, description="是否被隔离")
    
    created_at: datetime = Field(default_factory=datetime.now)
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        data = self.model_dump()
        data['timestamp'] = self.timestamp.isoformat()
        data['created_at'] = self.created_at.isoformat()
        return data
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Event':
        """从字典加载"""
        if 'timestamp' in data and isinstance(data['timestamp'], str):
            data['timestamp'] = datetime.fromisoformat(data['timestamp'])
        if 'created_at' in data and isinstance(data['created_at'], str):
            data['created_at'] = datetime.fromisoformat(data['created_at'])
        return cls(**data)


class Timeline(BaseModel):
    """时间线模型"""
    id: str = Field(description="时间线唯一ID")
    title: str = Field(description="时间线标题")
    start_time: Optional[datetime] = Field(default=None, description="开始时间")
    end_time: Optional[datetime] = Field(default=None, description="结束时间")
    
    events: List[Event] = Field(default_factory=list, description="事件列表")
    quarantined_events: List[Event] = Field(default_factory=list, description="被隔离的事件列表")
    
    service: Optional[str] = Field(default=None, description="相关服务")
    environment: Optional[str] = Field(default=None, description="环境")
    
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    
    def sort_events(self) -> None:
        """按时间排序事件"""
        self.events.sort(key=lambda e: e.timestamp)
        if self.events:
            self.start_time = self.events[0].timestamp
            self.end_time = self.events[-1].timestamp
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        data = self.model_dump()
        data['events'] = [e.to_dict() for e in self.events]
        data['quarantined_events'] = [e.to_dict() for e in self.quarantined_events]
        if self.start_time:
            data['start_time'] = self.start_time.isoformat()
        if self.end_time:
            data['end_time'] = self.end_time.isoformat()
        data['created_at'] = self.created_at.isoformat()
        data['updated_at'] = self.updated_at.isoformat()
        return data
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Timeline':
        """从字典加载"""
        events_data = data.pop('events', [])
        quarantined_data = data.pop('quarantined_events', [])
        
        if 'start_time' in data and isinstance(data['start_time'], str):
            data['start_time'] = datetime.fromisoformat(data['start_time'])
        if 'end_time' in data and isinstance(data['end_time'], str):
            data['end_time'] = datetime.fromisoformat(data['end_time'])
        if 'created_at' in data and isinstance(data['created_at'], str):
            data['created_at'] = datetime.fromisoformat(data['created_at'])
        if 'updated_at' in data and isinstance(data['updated_at'], str):
            data['updated_at'] = datetime.fromisoformat(data['updated_at'])
        
        timeline = cls(**data)
        timeline.events = [Event.from_dict(e) for e in events_data]
        timeline.quarantined_events = [Event.from_dict(e) for e in quarantined_data]
        return timeline

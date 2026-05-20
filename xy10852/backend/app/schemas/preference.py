from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime
from enum import Enum


class ChannelType(str, Enum):
    SMS = "sms"
    EMAIL = "email"
    IN_APP = "in_app"


class SourceType(str, Enum):
    USER_PROFILE = "user_profile"
    ADMIN_PANEL = "admin_panel"
    BATCH_IMPORT = "batch_import"
    API = "api"
    MARKETING_CAMPAIGN = "marketing_campaign"


class PreferenceStatus(str, Enum):
    ACTIVE = "active"
    PENDING = "pending"
    CONFLICT = "conflict"
    ERROR = "error"
    MERGED = "merged"


class BusinessScene(str, Enum):
    TRANSACTIONAL = "transactional"
    MARKETING = "marketing"
    SECURITY = "security"
    SYSTEM = "system"


class InterceptionStatus(str, Enum):
    PENDING = "pending"
    ALLOWED = "allowed"
    BLOCKED = "blocked"
    REVIEWED = "reviewed"


class PreferenceCreate(BaseModel):
    user_id: str = Field(..., description="用户ID")
    channel: ChannelType = Field(..., description="通知渠道")
    business_scene: BusinessScene = Field(..., description="业务场景")
    enabled: bool = Field(default=True, description="是否启用")
    source: SourceType = Field(..., description="来源入口")
    expires_at: Optional[datetime] = Field(None, description="过期时间")
    meta_data: Optional[Dict[str, Any]] = Field(default_factory=dict, description="元数据")


class PreferenceUpdate(BaseModel):
    enabled: Optional[bool] = None
    expires_at: Optional[datetime] = None
    meta_data: Optional[Dict[str, Any]] = None
    status: Optional[PreferenceStatus] = None


class PreferenceResponse(BaseModel):
    id: int
    user_id: str
    channel: ChannelType
    business_scene: BusinessScene
    enabled: bool
    source: SourceType
    source_priority: int
    status: PreferenceStatus
    created_at: datetime
    updated_at: Optional[datetime]
    expires_at: Optional[datetime]
    meta_data: Dict[str, Any]

    class Config:
        from_attributes = True


class ChangeHistoryResponse(BaseModel):
    id: int
    preference_id: Optional[int]
    user_id: str
    channel: Optional[ChannelType]
    business_scene: Optional[BusinessScene]
    old_value: Optional[Dict[str, Any]]
    new_value: Optional[Dict[str, Any]]
    source: Optional[SourceType]
    operator: Optional[str]
    change_type: Optional[str]
    snapshot: Optional[Dict[str, Any]]
    created_at: datetime

    class Config:
        from_attributes = True


class SendInterceptionCreate(BaseModel):
    user_id: str
    channel: ChannelType
    business_scene: BusinessScene
    message_id: Optional[str] = None


class SendInterceptionResponse(BaseModel):
    id: int
    user_id: str
    channel: ChannelType
    business_scene: BusinessScene
    status: InterceptionStatus
    reason: Optional[str]
    interception_rule: Optional[str]
    message_id: Optional[str]
    checked_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class AnomalyQueueResponse(BaseModel):
    id: int
    user_id: str
    channel: ChannelType
    business_scene: BusinessScene
    anomaly_type: str
    description: Optional[str]
    source: SourceType
    status: str
    retry_count: int
    max_retries: int
    last_retry_at: Optional[datetime]
    resolved_at: Optional[datetime]
    resolver: Optional[str]
    resolution_note: Optional[str]
    created_at: datetime
    meta_data: Dict[str, Any]

    class Config:
        from_attributes = True


class PreferenceMergeRequest(BaseModel):
    user_id: str
    channel: ChannelType
    business_scene: BusinessScene


class ExportRequest(BaseModel):
    user_id: Optional[str] = None
    channel: Optional[ChannelType] = None
    business_scene: Optional[BusinessScene] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    export_format: str = Field(default="json", description="导出格式: json, csv, excel")


class StatusAdvanceRequest(BaseModel):
    anomaly_id: int
    target_status: str
    resolution_note: Optional[str] = None
    resolver: Optional[str] = None


class ValidationResult(BaseModel):
    allowed: bool
    reason: Optional[str] = None
    rule: Optional[str] = None


class ConflictInfo(BaseModel):
    existing_preference: PreferenceResponse
    new_preference: PreferenceCreate
    conflict_type: str

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from app.models import GrayStatus, ApprovalStatus

class DeviceChannelBase(BaseModel):
    name: str
    code: str
    description: Optional[str] = None
    is_active: bool = True

class DeviceChannelCreate(DeviceChannelBase):
    pass

class DeviceChannelResponse(DeviceChannelBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        orm_mode = True

class AppVersionBase(BaseModel):
    version: str
    build_number: Optional[str] = None
    channel_id: int
    download_url: Optional[str] = None
    file_size: Optional[float] = None
    release_notes: Optional[str] = None
    is_active: bool = True

class AppVersionCreate(AppVersionBase):
    pass

class AppVersionResponse(AppVersionBase):
    id: int
    created_at: datetime
    channel: Optional[DeviceChannelResponse] = None
    
    class Config:
        orm_mode = True

class GrayRuleBase(BaseModel):
    name: str
    version_id: int
    target_version_id: int
    gray_ratio: float = Field(default=0, ge=0, le=100)
    crash_rate_threshold: float = Field(default=0.01, ge=0, le=1)
    device_channels: Optional[str] = None
    white_list: Optional[str] = None
    black_list: Optional[str] = None
    description: Optional[str] = None
    created_by: Optional[str] = None

class GrayRuleCreate(GrayRuleBase):
    request_id: str

class GrayRuleUpdate(BaseModel):
    name: Optional[str] = None
    gray_ratio: Optional[float] = None
    crash_rate_threshold: Optional[float] = None
    device_channels: Optional[str] = None
    description: Optional[str] = None

class GrayRuleResponse(GrayRuleBase):
    id: int
    request_id: str
    status: GrayStatus
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    version: Optional[AppVersionResponse] = None
    target_version: Optional[AppVersionResponse] = None
    
    class Config:
        orm_mode = True

class ApprovalRecordBase(BaseModel):
    gray_rule_id: int
    approver: str
    status: ApprovalStatus = ApprovalStatus.PENDING
    comment: Optional[str] = None

class ApprovalRecordCreate(ApprovalRecordBase):
    pass

class ApprovalRecordResponse(ApprovalRecordBase):
    id: int
    approved_at: Optional[datetime] = None
    created_at: datetime
    
    class Config:
        orm_mode = True

class ReleaseRecordBase(BaseModel):
    gray_rule_id: int
    release_type: str
    status: str
    details: Optional[str] = None
    released_by: Optional[str] = None

class ReleaseRecordCreate(ReleaseRecordBase):
    pass

class ReleaseRecordResponse(ReleaseRecordBase):
    id: int
    released_at: datetime
    
    class Config:
        orm_mode = True

class GrayStatsResponse(BaseModel):
    id: int
    gray_rule_id: int
    total_devices: int
    gray_devices: int
    upgrade_count: int
    crash_count: int
    crash_rate: float
    recorded_at: datetime
    
    class Config:
        orm_mode = True

class DashboardStats(BaseModel):
    total_gray_rules: int
    running_gray_rules: int
    success_rate: float
    avg_crash_rate: float
    recent_releases: List[ReleaseRecordResponse]

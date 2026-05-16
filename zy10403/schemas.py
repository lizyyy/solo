from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List
from models import LeaseStatus, OperationType


class LeaseBase(BaseModel):
    branch_name: str = Field(..., description="分支名称")
    env_id: str = Field(..., description="环境编号")
    assignee: str = Field(..., description="占用人")
    lease_start: datetime = Field(..., description="租约开始时间")
    lease_end: datetime = Field(..., description="租约结束时间")
    renew_reason: Optional[str] = Field(None, description="续租理由")
    request_id: Optional[str] = Field(None, description="幂等请求ID")


class LeaseCreate(LeaseBase):
    pass


class LeaseUpdate(BaseModel):
    lease_end: Optional[datetime] = Field(None, description="新的租约结束时间")
    renew_reason: Optional[str] = Field(None, description="续租理由")
    assignee: Optional[str] = Field(None, description="变更占用人")
    status: Optional[LeaseStatus] = Field(None, description="状态变更")


class LeaseRelease(BaseModel):
    released_by: str = Field(..., description="释放人")
    release_reason: Optional[str] = Field(None, description="释放理由")
    force: bool = Field(False, description="是否强制释放")


class LeaseManualCorrect(BaseModel):
    branch_name: Optional[str] = None
    env_id: Optional[str] = None
    assignee: Optional[str] = None
    lease_start: Optional[datetime] = None
    lease_end: Optional[datetime] = None
    renew_reason: Optional[str] = None
    status: Optional[LeaseStatus] = None
    operator: str = Field(..., description="操作人")
    reason: str = Field(..., description="修正理由")


class LeaseResponse(LeaseBase):
    id: int
    status: LeaseStatus
    created_at: datetime
    updated_at: Optional[datetime]
    is_expired: bool

    class Config:
        from_attributes = True


class ReleaseLogResponse(BaseModel):
    id: int
    lease_id: int
    released_by: str
    release_reason: Optional[str]
    released_at: datetime
    is_forced: bool

    class Config:
        from_attributes = True


class AuditLogResponse(BaseModel):
    id: int
    operation: OperationType
    raw_input: str
    conclusion: str
    operator: Optional[str]
    success: bool
    created_at: datetime

    class Config:
        from_attributes = True


class LeaseDetailResponse(LeaseResponse):
    release_logs: List[ReleaseLogResponse] = []


class OccupancyReportItem(BaseModel):
    env_id: str
    total_leases: int
    active_leases: int
    expired_leases: int
    released_leases: int


class AssigneeReportItem(BaseModel):
    assignee: str
    active_leases: int
    total_leases: int


class OccupancyReportResponse(BaseModel):
    by_environment: List[OccupancyReportItem]
    by_assignee: List[AssigneeReportItem]
    total_environments: int
    total_active_leases: int
    total_expired_leases: int
    generated_at: datetime


class LeaseQueryParams(BaseModel):
    branch_name: Optional[str] = None
    env_id: Optional[str] = None
    assignee: Optional[str] = None
    status: Optional[LeaseStatus] = None
    include_expired: bool = Field(True, description="是否包含已过期的")
    only_active: bool = Field(False, description="仅显示活跃的")

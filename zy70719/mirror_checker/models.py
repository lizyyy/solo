from datetime import datetime, timedelta
from enum import Enum
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, validator


class FreshnessStatus(str, Enum):
    FRESH = "fresh"
    WARNING = "warning"
    STALE = "stale"
    CRITICAL = "critical"
    UNKNOWN = "unknown"


class BlockReason(str, Enum):
    VERSION_GAP_TOO_LARGE = "version_gap_too_large"
    OUTSIDE_SYNC_WINDOW = "outside_sync_window"
    MIRROR_SYNC_FAILED = "mirror_sync_failed"
    UPSTREAM_UNAVAILABLE = "upstream_unavailable"
    MANUAL_CONFIRMATION_REQUIRED = "manual_confirmation_required"
    NO_DATA = "no_data"
    UNKNOWN = "unknown"


class PackageVersion(BaseModel):
    name: str = Field(..., description="包名称")
    upstream_version: str = Field(..., description="上游版本")
    mirror_version: Optional[str] = Field(None, description="镜像版本")
    upstream_updated_at: Optional[datetime] = Field(None, description="上游更新时间")
    mirror_updated_at: Optional[datetime] = Field(None, description="镜像更新时间")
    is_available: bool = Field(True, description="镜像是否可用")

    @validator("name")
    def name_not_empty(cls, v):
        if not v or not v.strip():
            raise ValueError("包名称不能为空")
        return v.strip()

    @validator("upstream_version")
    def upstream_version_not_empty(cls, v):
        if not v or not v.strip():
            raise ValueError("上游版本不能为空")
        return v.strip()


class SyncWindow(BaseModel):
    name: str = Field(..., description="同步窗口名称")
    start_time: str = Field(..., description="窗口开始时间 (HH:MM)")
    end_time: str = Field(..., description="窗口结束时间 (HH:MM)")
    max_delay_hours: float = Field(..., description="最大允许延迟小时数", gt=0)

    @validator("start_time", "end_time")
    def validate_time_format(cls, v):
        try:
            datetime.strptime(v, "%H:%M")
            return v
        except ValueError:
            raise ValueError("时间格式必须为 HH:MM")


class BlockedProject(BaseModel):
    project_name: str = Field(..., description="项目名称")
    required_packages: List[str] = Field(..., description="所需包列表")
    priority: int = Field(1, description="优先级，1最高", ge=1, le=5)
    contact: Optional[str] = Field(None, description="联系人")
    description: Optional[str] = Field(None, description="项目描述")
    is_manually_confirmed: bool = Field(False, description="是否已人工确认")


class MirrorSource(BaseModel):
    name: str = Field(..., description="镜像源名称")
    url: str = Field(..., description="镜像源地址")
    type: str = Field(..., description="镜像源类型 (pypi/npm/maven等)")
    sync_frequency_hours: float = Field(..., description="同步频率小时数", gt=0)
    last_sync_time: Optional[datetime] = Field(None, description="上次同步时间")
    sync_window: Optional[SyncWindow] = Field(None, description="同步窗口配置")


class VersionGapResult(BaseModel):
    package_name: str
    has_gap: bool
    version_gap: Optional[str] = None
    major_gap: int = 0
    minor_gap: int = 0
    patch_gap: int = 0
    time_delay_hours: Optional[float] = None


class FreshnessCheckResult(BaseModel):
    package_name: str
    status: FreshnessStatus
    version_gap_result: VersionGapResult
    in_sync_window: bool
    block_reason: Optional[BlockReason] = None
    recommendation: Optional[str] = None
    requires_manual_confirm: bool = False


class ProjectBlockResult(BaseModel):
    project_name: str
    priority: int
    is_blocked: bool
    blocked_packages: List[str]
    block_reasons: Dict[str, BlockReason]
    contact: Optional[str] = None
    description: Optional[str] = None
    is_manually_confirmed: bool = False


class DirtyDataIssue(BaseModel):
    field: str
    value: Any
    issue_type: str
    message: str


class FreshnessReport(BaseModel):
    report_id: str
    generated_at: datetime
    mirror_source: MirrorSource
    total_packages: int
    fresh_packages: int
    stale_packages: int
    critical_packages: int
    average_delay_hours: float
    project_results: List[ProjectBlockResult]
    package_results: List[FreshnessCheckResult]
    overall_status: FreshnessStatus
    summary: Dict[str, Any]
    dirty_data_issues: List[DirtyDataIssue] = []
    has_dirty_data: bool = False

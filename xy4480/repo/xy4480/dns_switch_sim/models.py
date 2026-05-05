from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from enum import Enum
from pydantic import BaseModel, Field


class DNSRecordType(str, Enum):
    A = "A"
    AAAA = "AAAA"
    CNAME = "CNAME"
    MX = "MX"
    TXT = "TXT"


class Region(str, Enum):
    CN_MAIN = "cn_main"
    CN_HK = "cn_hk"
    CN_TW = "cn_tw"
    APAC = "apac"
    NA = "na"
    EU = "eu"
    SA = "sa"
    AF = "af"
    GLOBAL = "global"


class CDNVendor(str, Enum):
    CDN_A = "cdn_a"
    CDN_B = "cdn_b"
    ORIGIN = "origin"


class DNSRecord(BaseModel):
    domain: str
    record_type: DNSRecordType
    value: str
    ttl: int
    region: Region = Field(default=Region.GLOBAL)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class VendorExport(BaseModel):
    vendor: CDNVendor
    region: Region
    domain: str
    cname_target: str
    health_status: str
    last_check: datetime
    bandwidth_mbps: Optional[float] = None
    error_rate: Optional[float] = None


class ProbeLog(BaseModel):
    timestamp: datetime
    region: Region
    domain: str
    resolver_ip: str
    resolved_ips: List[str]
    resolved_cname: Optional[str] = None
    http_status: Optional[int] = None
    response_time_ms: Optional[int] = None
    success: bool


class SwitchPhase(str, Enum):
    TTL_LOWER = "ttl_lower"
    TRAFFIC_SHIFT = "traffic_shift"
    STABILIZATION = "stabilization"
    ROLLBACK = "rollback"
    COMPLETE = "complete"


class SwitchStep(BaseModel):
    step_id: str
    phase: SwitchPhase
    description: str
    target_vendor: CDNVendor
    region: Region
    start_time: datetime
    duration_minutes: int
    traffic_percent: int = Field(default=100, ge=0, le=100)
    expected_effective_time: Optional[datetime] = None


class SwitchPlan(BaseModel):
    plan_id: str
    name: str
    domain: str
    original_vendor: CDNVendor
    target_vendor: CDNVendor
    rollback_vendor: CDNVendor
    steps: List[SwitchStep]
    created_at: datetime
    planned_start_time: datetime


class CheckResultType(str, Enum):
    PASS = "pass"
    WARNING = "warning"
    FAIL = "fail"
    INFO = "info"


class CheckResult(BaseModel):
    check_id: str
    check_type: str
    description: str
    result: CheckResultType
    message: str
    region: Optional[Region] = None
    domain: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.now)
    details: Dict[str, Any] = Field(default_factory=dict)


class ReviewStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    NEEDS_REVIEW = "needs_review"


class ReviewItem(BaseModel):
    item_id: str
    check_result_id: str
    reviewer: Optional[str] = None
    status: ReviewStatus = Field(default=ReviewStatus.PENDING)
    comment: Optional[str] = None
    reviewed_at: Optional[datetime] = None


class SimulationResult(BaseModel):
    simulation_id: str
    plan_id: str
    domain: str
    simulated_time: datetime
    check_results: List[CheckResult]
    review_items: List[ReviewItem]
    effective_regions: Dict[Region, bool]
    rollback_available: bool
    rollback_window_minutes: Optional[int] = None

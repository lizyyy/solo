from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum


class ReviewStatus(str, Enum):
    PENDING = "待复核"
    CONFIRMED = "已确认"
    NEEDS_MORE_INFO = "待补充"
    RESOLVED = "已处理"


class NextRole(str, Enum):
    MUNICIPAL_INSPECTOR = "市政巡检员"
    STREET_PLANNER = "街道规划员小姜"
    BOTH = "双方协同"


@dataclass
class CommunityAlias:
    community_id: str
    old_name: str
    new_name: str
    detected_at: datetime = field(default_factory=datetime.now)
    reviewed: bool = False
    reviewer: Optional[str] = None
    review_note: Optional[str] = None


@dataclass
class Community:
    id: str
    name: str
    aliases: List[str] = field(default_factory=list)
    address: Optional[str] = None
    district: Optional[str] = None


@dataclass
class Shop:
    id: str
    name: str
    community_id: str
    address: str
    shop_type: str
    has_fume_hood: bool = False
    fume_hood_install_date: Optional[str] = None
    contact_person: Optional[str] = None
    contact_phone: Optional[str] = None


@dataclass
class AccessibilityRampRecord:
    id: str
    shop_id: str
    community_name: str
    has_ramp: bool
    inspection_date: str
    ramp_width: Optional[float] = None
    ramp_slope: Optional[float] = None
    has_handrail: bool = False
    inspector: Optional[str] = None
    notes: Optional[str] = None
    status: ReviewStatus = ReviewStatus.PENDING


@dataclass
class NightSamplingPoint:
    id: str
    shop_id: str
    community_name: str
    sampling_date: str
    sampling_time: str
    fume_concentration: float
    standard_limit: float = 2.0
    is_qualified: Optional[bool] = None
    sampler: Optional[str] = None
    notes: Optional[str] = None
    status: ReviewStatus = ReviewStatus.PENDING


@dataclass
class FumeIssueRecord:
    id: str
    shop_id: str
    shop_name: str
    community_name: str
    reason_kept: str
    ramp_record_id: Optional[str] = None
    sampling_point_id: Optional[str] = None
    missing_materials: List[str] = field(default_factory=list)
    next_role: NextRole = NextRole.BOTH
    status: ReviewStatus = ReviewStatus.PENDING
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    has_alias_issue: bool = False
    alias_community_id: Optional[str] = None


@dataclass
class StreetSummary:
    total_shops: int = 0
    shops_with_issues: int = 0
    pending_review: int = 0
    alias_issues: int = 0
    missing_ramp_records: int = 0
    missing_sampling_points: int = 0
    issues: List[Dict[str, Any]] = field(default_factory=list)
    generated_at: datetime = field(default_factory=datetime.now)


@dataclass
class DataStore:
    communities: Dict[str, Community] = field(default_factory=dict)
    shops: Dict[str, Shop] = field(default_factory=dict)
    ramp_records: Dict[str, AccessibilityRampRecord] = field(default_factory=dict)
    sampling_points: Dict[str, NightSamplingPoint] = field(default_factory=dict)
    issue_records: Dict[str, FumeIssueRecord] = field(default_factory=dict)
    community_aliases: List[CommunityAlias] = field(default_factory=list)

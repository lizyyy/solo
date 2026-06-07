from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional, Dict
from enum import Enum


class OpinionStatus(str, Enum):
    COMPLETE = "完整"
    SUMMARY_ONLY = "只剩汇总无原文"
    PENDING_REVIEW = "待书记复核"


class RecordStatus(str, Enum):
    NORMAL = "正常"
    NEEDS_REVIEW = "需复核"
    CONFLICT = "有冲突"
    RESOLVED = "已解决"


class DataSource(str, Enum):
    DAY_SURVEY = "日间走访"
    NIGHT_SAMPLING = "夜间采样"
    MANUAL_CORRECTION = "人工修正"


@dataclass
class ResidentOpinion:
    id: str
    resident_name: str
    address: str
    summary: str
    original_text: Optional[str] = None
    status: OpinionStatus = OpinionStatus.COMPLETE


@dataclass
class AccessibilityRamp:
    id: str
    location: str
    has_ramp: bool
    notes: str = ""


@dataclass
class SiteRecord:
    id: str
    site_name: str
    address: str
    area_sqm: float
    accessibility_ramp: Optional[AccessibilityRamp] = None
    opinions: List[ResidentOpinion] = field(default_factory=list)
    source: DataSource = DataSource.DAY_SURVEY
    status: RecordStatus = RecordStatus.NORMAL
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    conflict_notes: str = ""
    review_notes: str = ""


@dataclass
class NightSamplingPoint:
    id: str
    location: str
    sampling_time: str
    old_criteria_data: Optional[str] = None
    notes: str = ""
    linked_site_id: Optional[str] = None


@dataclass
class ConflictReviewItem:
    id: str
    site_id: str
    site_name: str
    conflict_type: str
    description: str
    source_before: str
    source_after: str
    status: str = "待处理"
    handler: Optional[str] = None
    resolved_at: Optional[datetime] = None
    resolution_notes: str = ""


@dataclass
class ProjectState:
    name: str
    sites: List[SiteRecord] = field(default_factory=list)
    night_points: List[NightSamplingPoint] = field(default_factory=list)
    conflict_review: List[ConflictReviewItem] = field(default_factory=list)
    run_count: int = 0
    last_ran_at: Optional[datetime] = None

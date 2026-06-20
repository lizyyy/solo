from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any
from datetime import datetime
from enum import Enum


class RecordStatus(str, Enum):
    NORMAL = "normal"
    UNIT_MISSING = "unit_missing"
    UNIT_INCONSISTENT = "unit_inconsistent"
    LATE_ARRIVAL = "late_arrival"
    SUPPLEMENTARY = "supplementary"
    PENDING_REVIEW = "pending_review"


@dataclass
class RawRecord:
    record_id: str
    category: str
    metric_name: str
    value: float
    source: str
    unit: Optional[str] = None
    dimension: Optional[str] = None
    submitted_at: Optional[datetime] = None
    is_late: bool = False
    supplementary_note: Optional[str] = None
    raw_text: Optional[str] = None


@dataclass
class ValidatedRecord:
    raw: RawRecord
    status: RecordStatus
    issues: List[str] = field(default_factory=list)
    standard_value: Optional[float] = None
    standard_unit: Optional[str] = None
    original_value: Optional[float] = None
    original_unit: Optional[str] = None
    can_release: bool = False
    release_reason: Optional[str] = None
    need_supplement: List[str] = field(default_factory=list)


@dataclass
class FilterCriteria:
    category: str = "全部"
    status_filter: Optional[List[RecordStatus]] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    keyword: Optional[str] = None


@dataclass
class Statistics:
    total_count: int = 0
    normal_count: int = 0
    unit_missing_count: int = 0
    unit_inconsistent_count: int = 0
    late_arrival_count: int = 0
    supplementary_count: int = 0
    pending_review_count: int = 0
    can_release_count: int = 0
    need_supplement_count: int = 0
    by_category: Dict[str, int] = field(default_factory=dict)
    total_standard_value: Optional[float] = None
    avg_standard_value: Optional[float] = None


@dataclass
class UnifiedResultSet:
    filter_criteria: FilterCriteria
    all_records: List[ValidatedRecord]
    filtered_records: List[ValidatedRecord]
    statistics: Statistics
    generated_at: datetime = field(default_factory=datetime.now)
    source_hash: str = ""


@dataclass
class ReportContent:
    title: str
    progress_summary: str
    gap_analysis: str
    supplement_list: List[Dict[str, str]]
    release_list: List[Dict[str, str]]
    issue_list: List[Dict[str, str]]
    statistics_table: str
    details_table: str
    filter_description: str
    generated_at: str

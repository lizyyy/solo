from __future__ import annotations

import enum
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Optional


class Judgement(enum.Enum):
    PASS = "pass"
    FAIL = "fail"
    BORDERLINE = "borderline"
    CONFLICT = "conflict"
    SKIPPED = "skipped"


class Stratum(enum.Enum):
    HIGH_VOLUME = "high_volume"
    MID_VOLUME = "mid_volume"
    LOW_VOLUME = "low_volume"
    NEW_CREATIVE = "new_creative"
    UNCLASSIFIED = "unclassified"


@dataclass
class EvalLog:
    log_id: str
    creative_id: str
    arm_name: str
    impressions: Optional[int]
    clicks: Optional[int]
    conversions: Optional[float]
    revenue: Optional[float]
    ctr: Optional[float]
    cvr: Optional[float]
    source_file: str
    log_timestamp: Optional[datetime]
    ingested_at: datetime = field(default_factory=datetime.now)

    @property
    def has_nulls(self) -> bool:
        return any(
            v is None
            for v in (
                self.impressions,
                self.clicks,
                self.conversions,
                self.revenue,
                self.ctr,
                self.cvr,
            )
        )

    @property
    def fingerprint(self) -> str:
        return f"{self.creative_id}:{self.arm_name}:{self.log_id}"


@dataclass
class Annotation:
    annotation_id: str
    creative_id: str
    arm_name: str
    label: str
    annotator: str
    note: str = ""
    source_file: str = ""
    annotated_at: Optional[datetime] = None
    ingested_at: datetime = field(default_factory=datetime.now)


@dataclass
class ThresholdNote:
    note_id: str
    metric: str
    operator: str
    threshold: float
    stratum: str
    description: str = ""
    source_file: str = ""
    created_at: Optional[datetime] = None
    ingested_at: datetime = field(default_factory=datetime.now)


@dataclass
class ConflictCase:
    conflict_id: str
    creative_id: str
    arm_name: str
    eval_judgement: str
    annotation_label: str
    reason: str
    resolution: Optional[str] = None
    source_file: str = ""
    detected_at: Optional[datetime] = None
    ingested_at: datetime = field(default_factory=datetime.now)


@dataclass
class EvidenceLink:
    source_type: str
    source_id: str
    source_file: str
    detail: str = ""


@dataclass
class EvalResult:
    result_id: str
    creative_id: str
    arm_name: str
    judgement: Judgement
    stratum: Stratum
    metric_values: dict[str, Optional[float]]
    threshold_results: list[dict[str, Any]]
    evidence_links: list[EvidenceLink]
    is_duplicate: bool
    duplicate_of: Optional[str]
    is_exception: bool
    exception_reason: str
    run_id: str
    source_log_id: str
    source_file: str
    evaluated_at: datetime = field(default_factory=datetime.now)

    @property
    def fingerprint(self) -> str:
        return f"{self.creative_id}:{self.arm_name}"


@dataclass
class RunSummary:
    run_id: str
    total_samples: int
    unique_samples: int
    duplicate_count: int
    null_count: int
    exception_count: int
    stratum_counts: dict[str, int]
    judgement_counts: dict[str, int]
    conflict_count: int
    evaluated_at: datetime = field(default_factory=datetime.now)


@dataclass
class RerunDiff:
    current_run_id: str
    previous_run_id: str
    metric_diffs: list[dict[str, Any]]
    sample_added: list[str]
    sample_removed: list[str]
    sample_changed: list[dict[str, Any]]
    metric_only_changes: list[dict[str, Any]]
    sample_only_changes: list[dict[str, Any]]
    summary: dict[str, Any]

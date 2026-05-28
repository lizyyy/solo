from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Optional
import uuid


class AuditAction(str, Enum):
    CREATED = "created"
    UPDATED = "updated"
    ENRICHED = "enriched"
    BUCKETED = "bucketed"
    ENTROPY_COMPUTED = "entropy_computed"
    HOTZONE_IDENTIFIED = "hotzone_identified"
    ACTIVITY_COMPARED = "activity_compared"
    REPORT_GENERATED = "report_generated"
    NOISE_FILTERED = "noise_filtered"
    DEDUPLICATED = "deduplicated"


@dataclass
class AuditEntry:
    timestamp: str
    action: AuditAction
    actor: str
    detail: str
    snapshot: Optional[dict] = None


@dataclass
class AuditTrail:
    entries: list[AuditEntry] = field(default_factory=list)
    data_id: str = field(default_factory=lambda: uuid.uuid4().hex[:12])

    def record(self, action: AuditAction, actor: str, detail: str, snapshot: Optional[dict] = None):
        self.entries.append(AuditEntry(
            timestamp=datetime.now().isoformat(),
            action=action,
            actor=actor,
            detail=detail,
            snapshot=snapshot,
        ))

    def history(self) -> list[dict]:
        return [
            {
                "timestamp": e.timestamp,
                "action": e.action.value,
                "actor": e.actor,
                "detail": e.detail,
            }
            for e in self.entries
        ]

    def find_by_action(self, action: AuditAction) -> list[AuditEntry]:
        return [e for e in self.entries if e.action == action]


@dataclass
class Zone:
    zone_id: str
    name: str
    floor: int = 1
    area_m2: float = 0.0
    capacity: int = 0


@dataclass
class DwellRecord:
    visitor_id: str
    zone_id: str
    enter_time: str
    exit_time: str
    duration_seconds: float
    audit: AuditTrail = field(default_factory=AuditTrail)


@dataclass
class VisitorTrajectory:
    trajectory_id: str
    visitor_id: str
    entry_batch: str
    dwells: list[DwellRecord] = field(default_factory=list)
    activity_labels: list[str] = field(default_factory=list)
    path_sequence: list[str] = field(default_factory=list)
    audit: AuditTrail = field(default_factory=AuditTrail)

    def __post_init__(self):
        if not self.path_sequence and self.dwells:
            self.path_sequence = [d.zone_id for d in self.dwells]
        if not self.trajectory_id:
            self.trajectory_id = uuid.uuid4().hex[:10]


@dataclass
class EntryBatch:
    batch_id: str
    entry_time: str
    visitor_ids: list[str] = field(default_factory=list)
    audit: AuditTrail = field(default_factory=AuditTrail)


@dataclass
class ActivityLabel:
    label_id: str
    name: str
    description: str = ""
    start_time: str = ""
    end_time: str = ""
    affected_zones: list[str] = field(default_factory=list)
    audit: AuditTrail = field(default_factory=AuditTrail)


@dataclass
class PathBucket:
    bucket_id: str
    path_pattern: tuple[str, ...]
    trajectory_ids: list[str] = field(default_factory=list)
    count: int = 0
    probability: float = 0.0
    audit: AuditTrail = field(default_factory=AuditTrail)


@dataclass
class HotZone:
    zone_id: str
    zone_name: str
    total_dwell_seconds: float
    visit_count: int
    avg_dwell_seconds: float
    heat_rank: int
    interpretation: str
    audit: AuditTrail = field(default_factory=AuditTrail)


@dataclass
class EntropyResult:
    raw_entropy: float
    normalized_entropy: float
    max_entropy: float
    unique_paths: int
    total_trajectories: int
    path_distribution: dict[str, float]
    intermediate: dict[str, Any] = field(default_factory=dict)
    audit: AuditTrail = field(default_factory=AuditTrail)


@dataclass
class ActivityComparison:
    label: str
    entropy: float
    normalized_entropy: float
    trajectory_count: int
    dominant_path: Optional[str]
    interference_flag: bool
    interference_reason: str
    audit: AuditTrail = field(default_factory=AuditTrail)


@dataclass
class TrajectoryReport:
    report_id: str
    generated_at: str
    entropy_result: Optional[EntropyResult] = None
    path_buckets: list[PathBucket] = field(default_factory=list)
    hot_zones: list[HotZone] = field(default_factory=list)
    activity_comparisons: list[ActivityComparison] = field(default_factory=list)
    intermediates: dict[str, Any] = field(default_factory=dict)
    audit: AuditTrail = field(default_factory=AuditTrail)

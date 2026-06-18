from dataclasses import dataclass, field, asdict
from typing import Optional, List
from datetime import datetime
import uuid


@dataclass
class SiltRecord:
    id: str
    station: str
    measure_time: str
    silt_depth: float
    source: str
    version: str = "v1"
    is_drift: bool = False
    is_outlier: bool = False
    is_override: bool = False
    override_note: Optional[str] = None
    drift_reason: Optional[str] = None
    raw_value: Optional[float] = None
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())

    def to_dict(self):
        return asdict(self)


@dataclass
class CleanSnapshot:
    snapshot_id: str
    snapshot_name: str
    created_at: str
    filter_criteria: dict
    summary: dict
    records: List[dict]
    confirmed: bool = False
    confirmed_by: Optional[str] = None
    confirmed_at: Optional[str] = None
    delta_vs_previous: Optional[dict] = None

    def to_dict(self):
        return asdict(self)

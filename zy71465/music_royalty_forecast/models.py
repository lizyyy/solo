from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from datetime import date, datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple


class DataSource(str, Enum):
    PLAYBACK_HISTORY = "playback_history"
    PLATFORM_SHARING = "platform_sharing"
    ACTIVITY_CALENDAR = "activity_calendar"


class IssueSeverity(str, Enum):
    WARNING = "warning"
    ERROR = "error"


@dataclass
class SourceTrace:
    source_file: str
    source_type: DataSource
    original_row: int
    raw_line: str
    import_time: str = field(default_factory=lambda: datetime.now().isoformat())

    def trace_id(self) -> str:
        payload = f"{self.source_file}:{self.source_type.value}:{self.original_row}"
        return hashlib.md5(payload.encode()).hexdigest()[:12]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "trace_id": self.trace_id(),
            "source_file": self.source_file,
            "source_type": self.source_type.value,
            "original_row": self.original_row,
            "raw_line": self.raw_line,
            "import_time": self.import_time,
        }


@dataclass
class DataIssue:
    trace: SourceTrace
    severity: IssueSeverity
    rule_code: str
    message: str
    field_name: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        d = {
            "severity": self.severity.value,
            "rule_code": self.rule_code,
            "message": self.message,
            "source_file": self.trace.source_file,
            "original_row": self.trace.original_row,
            "raw_line": self.trace.raw_line,
        }
        if self.field_name:
            d["field_name"] = self.field_name
        return d


@dataclass
class PlaybackRecord:
    song_id: str
    platform: str
    date: date
    plays: int
    trace: SourceTrace

    def to_dict(self) -> Dict[str, Any]:
        return {
            "song_id": self.song_id,
            "platform": self.platform,
            "date": self.date.isoformat(),
            "plays": self.plays,
            "trace": self.trace.to_dict(),
        }


@dataclass
class SharingRecord:
    platform: str
    effective_date: date
    artist_share: float
    label_share: float
    platform_share: float
    trace: SourceTrace

    @property
    def total_share(self) -> float:
        return self.artist_share + self.label_share + self.platform_share

    def to_dict(self) -> Dict[str, Any]:
        return {
            "platform": self.platform,
            "effective_date": self.effective_date.isoformat(),
            "artist_share": self.artist_share,
            "label_share": self.label_share,
            "platform_share": self.platform_share,
            "total_share": self.total_share,
            "trace": self.trace.to_dict(),
        }


@dataclass
class ActivityRecord:
    activity_id: str
    song_id: str
    activity_type: str
    start_date: date
    end_date: date
    exposure_multiplier: float
    trace: SourceTrace

    def to_dict(self) -> Dict[str, Any]:
        return {
            "activity_id": self.activity_id,
            "song_id": self.song_id,
            "activity_type": self.activity_type,
            "start_date": self.start_date.isoformat(),
            "end_date": self.end_date.isoformat(),
            "exposure_multiplier": self.exposure_multiplier,
            "trace": self.trace.to_dict(),
        }


@dataclass
class TimeSeriesPoint:
    date: date
    value: float
    components: Dict[str, float] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "date": self.date.isoformat(),
            "value": round(self.value, 4),
            "components": {k: round(v, 4) for k, v in self.components.items()},
        }


@dataclass
class TimeSeries:
    song_id: str
    platform: str
    scenario: str
    points: List[TimeSeriesPoint] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "song_id": self.song_id,
            "platform": self.platform,
            "scenario": self.scenario,
            "point_count": len(self.points),
            "points": [p.to_dict() for p in self.points],
        }


@dataclass
class SharingMatrix:
    song_id: str
    platform: str
    effective_date: date
    artist_share: float
    label_share: float
    platform_share: float
    revenue_per_play: float
    trace: SourceTrace

    def revenue_for(self, plays: int, role: str = "label") -> float:
        share_map = {
            "artist": self.artist_share,
            "label": self.label_share,
            "platform": self.platform_share,
        }
        return plays * self.revenue_per_play * share_map.get(role, self.label_share)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "song_id": self.song_id,
            "platform": self.platform,
            "effective_date": self.effective_date.isoformat(),
            "artist_share": self.artist_share,
            "label_share": self.label_share,
            "platform_share": self.platform_share,
            "revenue_per_play": self.revenue_per_play,
            "trace": self.trace.to_dict(),
        }


@dataclass
class Scenario:
    name: str
    decay_rate: float
    decay_model: str
    growth_rate: float = 0.0
    description: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "decay_rate": self.decay_rate,
            "decay_model": self.decay_model,
            "growth_rate": self.growth_rate,
            "description": self.description,
        }


BUILTIN_SCENARIOS = {
    "baseline": Scenario(
        name="baseline",
        decay_rate=0.03,
        decay_model="exponential",
        growth_rate=0.0,
        description="基准情景：标准指数衰减",
    ),
    "optimistic": Scenario(
        name="optimistic",
        decay_rate=0.02,
        decay_model="exponential",
        growth_rate=0.005,
        description="乐观情景：衰减放缓且有自然增长",
    ),
    "pessimistic": Scenario(
        name="pessimistic",
        decay_rate=0.05,
        decay_model="exponential",
        growth_rate=0.0,
        description="悲观情景：加速衰减无增长",
    ),
}


@dataclass
class ImportResult:
    source_type: DataSource
    source_file: str
    valid_records: List[Any] = field(default_factory=list)
    issues: List[DataIssue] = field(default_factory=list)

    @property
    def total_rows(self) -> int:
        return len(self.valid_records) + len(self.issues)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "source_type": self.source_type.value,
            "source_file": self.source_file,
            "valid_count": len(self.valid_records),
            "issue_count": len(self.issues),
            "total_rows": self.total_rows,
            "issues": [i.to_dict() for i in self.issues],
        }


@dataclass
class ForecastResult:
    song_id: str
    platform: str
    scenario: str
    time_series: TimeSeries
    sharing_matrix: SharingMatrix
    total_revenue: float = 0.0
    traces: List[SourceTrace] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "song_id": self.song_id,
            "platform": self.platform,
            "scenario": self.scenario,
            "total_revenue": round(self.total_revenue, 4),
            "time_series": self.time_series.to_dict(),
            "sharing_matrix": self.sharing_matrix.to_dict(),
            "traces": [t.to_dict() for t in self.traces],
        }

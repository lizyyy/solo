from dataclasses import dataclass, field
from enum import Enum
from typing import List, Optional, Dict, Tuple
from datetime import datetime


class BeatType(str, Enum):
    DOWNBEAT = "downbeat"
    UPBEAT = "upbeat"
    WEAK_BEAT = "weak_beat"
    GHOST_NOTE = "ghost_note"


class DeviationType(str, Enum):
    LAG = "lag"
    LEAD = "lead"
    ON_TIME = "on_time"
    MISSED = "missed"
    NOISE = "noise"


class EventSeverity(str, Enum):
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"


class TimelineEventType(str, Enum):
    BPM_CHANGE = "bpm_change"
    WEAK_BEAT_MISS = "weak_beat_miss"
    NOISE_FALSE_POSITIVE = "noise_false_positive"
    MEASURE_START = "measure_start"
    SIGNIFICANT_DEVIATION = "significant_deviation"


@dataclass
class BeatEvent:
    time: float
    beat_type: BeatType
    measure: int
    beat_in_measure: int
    confidence: float = 1.0
    is_reference: bool = False


@dataclass
class BeatDeviation:
    beat_event: BeatEvent
    expected_time: float
    actual_time: float
    deviation_ms: float
    deviation_type: DeviationType
    severity: EventSeverity


@dataclass
class BPMEvidence:
    source: str
    bpm: float
    confidence: float
    time_range: Tuple[float, float]
    beat_count: int
    support_reason: str


@dataclass
class ConsistencyCheck:
    audio_conclusion: str
    reference_conclusion: str
    is_consistent: bool
    bpm_evidences: List[BPMEvidence]
    resolution_reason: str


@dataclass
class TimelineEvent:
    event_type: TimelineEventType
    time: float
    measure: int
    description: str
    severity: EventSeverity
    details: Dict = field(default_factory=dict)
    order: int = 0


@dataclass
class MeasureAnalysis:
    measure_number: int
    start_time: float
    end_time: float
    deviations: List[BeatDeviation]
    avg_deviation_ms: float
    has_lag: bool
    has_lead: bool
    has_missed: bool
    problem_summary: str
    beats: List[BeatEvent]


@dataclass
class ProgressComparison:
    has_previous: bool
    previous_avg_deviation: Optional[float]
    current_avg_deviation: float
    improvement_percent: float
    problem_measures_reduced: int
    human_reason: str


@dataclass
class AnalysisResult:
    audio_file: str
    reference_file: Optional[str]
    analyzed_at: datetime
    time_signature: Tuple[int, int]
    reference_bpm: float
    detected_bpm: float
    bpm_evidences: List[BPMEvidence]
    consistency_check: Optional[ConsistencyCheck]
    measures: List[MeasureAnalysis]
    timeline: List[TimelineEvent]
    total_measures: int
    total_beats: int
    lag_measures: List[int]
    lead_measures: List[int]
    missed_beat_measures: List[int]
    overall_avg_deviation_ms: float
    overall_deviation_std_ms: float
    problem_measures_summary: List[str]
    progress: Optional[ProgressComparison]
    human_summary: str

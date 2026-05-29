from enum import Enum
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class BeatType(str, Enum):
    QUARTER = "quarter"
    EIGHTH = "eighth"
    SIXTEENTH = "sixteenth"
    DOTTED_QUARTER = "dotted_quarter"
    HALF = "half"
    WHOLE = "whole"
    TRIPLET = "triplet"


class TupletGroup(BaseModel):
    group_id: str
    beat_type: BeatType = BeatType.TRIPLET
    subdivision_count: int = 3
    beat_indices: List[int]


class TempoChange(BaseModel):
    beat_index: int
    new_bpm: float


class RhythmNote(BaseModel):
    beat_index: int
    beat_type: BeatType
    duration_beats: float
    is_rest: bool = False
    tuplet_group_id: Optional[str] = None


class RhythmScore(BaseModel):
    score_id: str
    name: str
    bpm: float
    time_signature_num: int = 4
    time_signature_den: int = 4
    notes: List[RhythmNote]
    tuplet_groups: List[TupletGroup] = []
    tempo_changes: List[TempoChange] = []


class StudentTap(BaseModel):
    tap_index: int
    timestamp_ms: float


class BeatJudgment(str, Enum):
    PERFECT = "perfect"
    GOOD = "good"
    RUSHED = "rushed"
    DRAGGED = "dragged"
    MISSING = "missing"
    EXTRA = "extra"


class SingleBeatResult(BaseModel):
    beat_index: int
    expected_time_ms: float
    actual_time_ms: Optional[float]
    judgment: BeatJudgment
    offset_ms: Optional[float]
    is_tuplet: bool = False
    tuplet_group_id: Optional[str] = None


class LevelStatus(str, Enum):
    CREATED = "created"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"


class Level(BaseModel):
    level_id: str
    session_id: str
    score_id: str
    level_number: int
    status: LevelStatus = LevelStatus.CREATED
    taps: List[StudentTap] = []
    beat_results: List[SingleBeatResult] = []
    total_score: Optional[float] = None
    max_score: float = 100.0
    pass_threshold: float = 60.0
    created_at: datetime = Field(default_factory=datetime.now)
    completed_at: Optional[datetime] = None


class PlaybackHint(BaseModel):
    beat_index: int
    message: str
    severity: str = "info"


class ScoreReport(BaseModel):
    session_id: str
    level_id: str
    score_id: str
    level_number: int
    total_score: float
    max_score: float
    passed: bool
    perfect_count: int
    good_count: int
    rushed_count: int
    dragged_count: int
    missing_count: int
    extra_count: int
    tuplet_errors: int
    tempo_adaptation_score: Optional[float]
    beat_results: List[SingleBeatResult]
    playback_hints: List[PlaybackHint]
    created_at: datetime = Field(default_factory=datetime.now)


class CorrectionAudit(BaseModel):
    audit_id: str
    session_id: str
    level_id: str
    field_path: str
    old_value: str
    new_value: str
    reason: str
    corrected_by: str
    corrected_at: datetime = Field(default_factory=datetime.now)


class Session(BaseModel):
    session_id: str
    student_name: str
    levels: List[str] = []
    created_at: datetime = Field(default_factory=datetime.now)
    current_level: Optional[int] = None


class ErrorResponse(BaseModel):
    detail: str

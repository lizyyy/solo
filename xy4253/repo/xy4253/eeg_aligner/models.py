from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field


class SleepStage(str, Enum):
    WAKE = "W"
    N1 = "N1"
    N2 = "N2"
    N3 = "N3"
    REM = "R"
    MOVEMENT = "M"
    UNKNOWN = "?"


class EventType(str, Enum):
    STIMULUS = "stimulus"
    RESPONSE = "response"
    ARTIFACT = "artifact"
    SYSTEM = "system"
    SYNC = "sync"


class IssueSeverity(str, Enum):
    CRITICAL = "critical"
    WARNING = "warning"
    INFO = "info"


class IssueType(str, Enum):
    MISSING_CODE = "missing_code"
    DUPLICATE_CODE = "duplicate_code"
    STAGE_CONFLICT = "stage_conflict"
    ARTIFACT_OVERLAP = "artifact_overlap"
    CLOCK_DRIFT = "clock_drift"
    INVALID_TIMESTAMP = "invalid_timestamp"


@dataclass
class EEGChannelSummary:
    channel_name: str
    sampling_rate: float
    start_time: datetime
    end_time: datetime
    total_samples: int
    valid_samples: int
    artifact_percentage: float
    quality_metrics: Dict[str, float] = field(default_factory=dict)


@dataclass
class StimulusEvent:
    event_id: str
    event_code: int
    event_type: EventType
    timestamp: datetime
    eeg_timestamp: Optional[datetime] = None
    aligned_timestamp: Optional[datetime] = None
    duration_ms: Optional[float] = None
    description: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)
    is_artifact: bool = False
    is_valid: bool = True
    issues: List["ValidationIssue"] = field(default_factory=list)


@dataclass
class SleepStageEpoch:
    epoch_number: int
    stage: SleepStage
    start_time: datetime
    end_time: datetime
    duration_seconds: float = 30.0
    confidence: float = 1.0
    is_manual: bool = True
    notes: str = ""


@dataclass
class ClockCalibration:
    calibration_id: str
    calibration_time: datetime
    eeg_clock_time: datetime
    stimulus_clock_time: datetime
    drift_ms: float
    sync_event_code: Optional[int] = None
    notes: str = ""


@dataclass
class ValidationIssue:
    issue_id: str
    issue_type: IssueType
    severity: IssueSeverity
    message: str
    related_event: Optional[str] = None
    related_epoch: Optional[int] = None
    timestamp: Optional[datetime] = None
    details: Dict[str, Any] = field(default_factory=dict)
    suggestion: str = ""


@dataclass
class AlignmentResult:
    drift_estimate_ms: float
    drift_confidence: float
    alignment_method: str
    sync_points: List[Dict[str, Any]] = field(default_factory=list)
    aligned_events_count: int = 0
    issues: List[ValidationIssue] = field(default_factory=list)


@dataclass
class CheckResult:
    total_events: int
    valid_events: int
    total_epochs: int
    issues: List[ValidationIssue] = field(default_factory=list)
    missing_codes: List[int] = field(default_factory=list)
    duplicate_codes: List[int] = field(default_factory=list)
    stage_conflicts: List[Dict] = field(default_factory=list)
    artifact_overlaps: List[Dict] = field(default_factory=list)
    critical_issue_count: int = 0
    warning_issue_count: int = 0
    info_issue_count: int = 0


@dataclass
class ProjectData:
    project_id: str
    created_at: datetime
    updated_at: datetime
    
    eeg_summaries: List[EEGChannelSummary] = field(default_factory=list)
    events: List[StimulusEvent] = field(default_factory=list)
    sleep_stages: List[SleepStageEpoch] = field(default_factory=list)
    clock_calibrations: List[ClockCalibration] = field(default_factory=list)
    
    alignment_result: Optional[AlignmentResult] = None
    check_result: Optional[CheckResult] = None
    
    metadata: Dict[str, Any] = field(default_factory=dict)

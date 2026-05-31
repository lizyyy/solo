from __future__ import annotations

import enum
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any


class AnomalyType(enum.Enum):
    FRAME_DROP = "frame_drop"
    SIGNAL_LOSS = "signal_loss"
    DATA_CORRUPTION = "data_corruption"
    OUT_OF_BOUNDS = "out_of_bounds"
    TIMESTAMP_GAP = "timestamp_gap"
    VALUE_GLITCH = "value_glitch"


class Severity(enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class EvidenceType(enum.Enum):
    FAULT_RECORD = "fault_record"
    ORBITAL_ELEMENT = "orbital_element"
    TELEMETRY_SEGMENT = "telemetry_segment"
    WINDOW_ENTRY = "window_entry"
    MANUAL_NOTE = "manual_note"


class RunStatus(enum.Enum):
    COMPLETED = "completed"
    PARTIAL = "partial"
    FAILED = "failed"


@dataclass
class FaultRecord:
    fault_id: str
    timestamp: datetime
    subsystem: str
    description: str
    severity: Severity
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class TelemetrySegment:
    seg_id: str
    start_time: datetime
    end_time: datetime
    source: str
    frame_count: int
    expected_frames: int
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class OrbitalElement:
    element_id: str
    timestamp: datetime
    semi_major_axis: float | None = None
    eccentricity: float | None = None
    inclination: float | None = None
    raan: float | None = None
    arg_perigee: float | None = None
    mean_anomaly: float | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class WindowEntry:
    window_id: str
    start_time: datetime
    end_time: datetime
    task_type: str
    subsystem: str
    overlap_with: list[str] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class AnomalyRecord:
    anomaly_id: str
    timestamp: datetime
    anomaly_type: AnomalyType
    telemetry_seg_id: str
    description: str
    severity: Severity
    observed_value: Any = None
    expected_value: Any = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class AttributionRun:
    run_id: str
    run_timestamp: datetime
    batch_hash: str
    input_anomaly_count: int
    status: RunStatus
    notes: str = ""
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class EvidenceLink:
    link_id: str
    result_id: str
    source_type: EvidenceType
    source_id: str
    relevance: str
    excerpt: str = ""


@dataclass
class AttributionResult:
    result_id: str
    run_id: str
    anomaly_id: str
    attributed_cause: str
    confidence: float
    verifiable_reason: str
    evidence_links: list[EvidenceLink] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)

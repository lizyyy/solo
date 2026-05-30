from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, date, time, timedelta
from enum import Enum
from typing import Optional, List, Dict, Any


class RecordStatus(str, Enum):
    RECEIVED = "received"
    VALIDATING = "validating"
    ANOMALY_CHECKING = "anomaly_checking"
    SIMULATING = "simulating"
    PREDICTED = "predicted"
    COMPLETED = "completed"
    ANOMALY_FLAGGED = "anomaly_flagged"
    RETURNED_FOR_SUPPLEMENT = "returned_for_supplement"
    SUPPLEMENTED = "supplemented"
    FAILED = "failed"

    def can_transition_to(self, target: "RecordStatus") -> bool:
        transitions = {
            RecordStatus.RECEIVED: [RecordStatus.VALIDATING],
            RecordStatus.VALIDATING: [RecordStatus.ANOMALY_CHECKING, RecordStatus.RETURNED_FOR_SUPPLEMENT, RecordStatus.FAILED],
            RecordStatus.ANOMALY_CHECKING: [RecordStatus.SIMULATING, RecordStatus.ANOMALY_FLAGGED],
            RecordStatus.SIMULATING: [RecordStatus.PREDICTED, RecordStatus.FAILED],
            RecordStatus.PREDICTED: [RecordStatus.COMPLETED],
            RecordStatus.ANOMALY_FLAGGED: [RecordStatus.SIMULATING, RecordStatus.RETURNED_FOR_SUPPLEMENT],
            RecordStatus.RETURNED_FOR_SUPPLEMENT: [RecordStatus.SUPPLEMENTED],
            RecordStatus.SUPPLEMENTED: [RecordStatus.VALIDATING],
            RecordStatus.COMPLETED: [],
            RecordStatus.FAILED: [],
        }
        return target in transitions.get(self, [])


class AnomalyType(str, Enum):
    SKIP_DUPLICATE = "skip_duplicate"
    DOCTOR_SUSPENDED = "doctor_suspended"
    ADDON_QUEUE_JUMP = "addon_queue_jump"
    MISSING_SCHEDULE = "missing_schedule"
    CONFLICTING_ROOM = "conflicting_room"
    NONE = "none"


@dataclass
class Registration:
    reg_id: str = field(default_factory=lambda: uuid.uuid4().hex[:12])
    patient_name: str = ""
    patient_id: str = ""
    doctor_id: str = ""
    doctor_name: str = ""
    dept: str = ""
    clinic_date: date = field(default_factory=date.today)
    slot_time: Optional[time] = None
    queue_number: int = 0
    is_addon: bool = False
    reg_time: Optional[datetime] = None
    status: RecordStatus = RecordStatus.RECEIVED
    last_successful_stage: RecordStatus = RecordStatus.RECEIVED
    anomaly_types: List[AnomalyType] = field(default_factory=list)
    anomaly_details: Dict[str, Any] = field(default_factory=dict)
    supplement_materials: Dict[str, Any] = field(default_factory=dict)
    returned_reason: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)

    def transition_to(self, target: RecordStatus) -> None:
        if not self.status.can_transition_to(target):
            raise ValueError(
                f"Cannot transition {self.reg_id} from {self.status.value} to {target.value}"
            )
        if target not in (RecordStatus.FAILED, RecordStatus.RETURNED_FOR_SUPPLEMENT):
            self.last_successful_stage = target
        self.status = target

    def return_for_supplement(self, reason: str) -> None:
        self.transition_to(RecordStatus.RETURNED_FOR_SUPPLEMENT)
        self.returned_reason = reason

    def supplement(self, materials: Dict[str, Any]) -> None:
        self.supplement_materials.update(materials)
        self.transition_to(RecordStatus.SUPPLEMENTED)
        self.transition_to(RecordStatus.VALIDATING)


@dataclass
class DoctorSchedule:
    doctor_id: str = ""
    doctor_name: str = ""
    dept: str = ""
    clinic_date: date = field(default_factory=date.today)
    shift: str = "morning"
    start_time: time = time(8, 0)
    end_time: time = time(12, 0)
    room_id: str = ""
    is_suspended: bool = False
    avg_consult_minutes: float = 10.0
    max_addon_slots: int = 5
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class SkipRecord:
    skip_id: str = field(default_factory=lambda: uuid.uuid4().hex[:12])
    reg_id: str = ""
    doctor_id: str = ""
    clinic_date: date = field(default_factory=date.today)
    skip_time: Optional[datetime] = None
    recall_time: Optional[datetime] = None
    is_duplicate: bool = False
    skip_count: int = 1
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class AddOnRequest:
    request_id: str = field(default_factory=lambda: uuid.uuid4().hex[:12])
    reg_id: str = ""
    doctor_id: str = ""
    patient_name: str = ""
    clinic_date: date = field(default_factory=date.today)
    request_time: Optional[datetime] = None
    approved: bool = False
    priority: int = 0
    insert_position: Optional[int] = None
    is_queue_jump: bool = False
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ClinicRoom:
    room_id: str = ""
    room_name: str = ""
    dept: str = ""
    is_available: bool = True
    current_doctor_id: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class SimulationResult:
    reg_id: str = ""
    queue_position: int = 0
    estimated_wait_minutes: float = 0.0
    estimated_start_time: Optional[datetime] = None
    estimated_end_time: Optional[datetime] = None
    skip_penalty_minutes: float = 0.0
    addon_delay_minutes: float = 0.0
    ahead_count: int = 0
    anomaly_adjusted: bool = False
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class PredictionResult:
    reg_id: str = ""
    predicted_wait_minutes: float = 0.0
    confidence_low: float = 0.0
    confidence_high: float = 0.0
    predicted_start_time: Optional[datetime] = None
    factors: Dict[str, float] = field(default_factory=dict)
    anomaly_explanations: List[str] = field(default_factory=list)
    param_snapshot_id: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class TimelineEvent:
    event_type: str
    time_point: Optional[datetime] = None
    label: str = ""
    duration_minutes: float = 0.0
    reg_id: str = ""
    doctor_id: str = ""
    is_anomaly: bool = False
    detail: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class PipelineContext:
    registrations: List[Registration] = field(default_factory=list)
    schedules: List[DoctorSchedule] = field(default_factory=list)
    skips: List[SkipRecord] = field(default_factory=list)
    addons: List[AddOnRequest] = field(default_factory=list)
    rooms: List[ClinicRoom] = field(default_factory=list)
    simulation_results: Dict[str, SimulationResult] = field(default_factory=dict)
    prediction_results: Dict[str, PredictionResult] = field(default_factory=dict)
    timeline_events: List[TimelineEvent] = field(default_factory=list)
    anomaly_flags: Dict[str, List[AnomalyType]] = field(default_factory=dict)
    param_snapshot_id: str = ""
    filter_conditions: Dict[str, Any] = field(default_factory=dict)

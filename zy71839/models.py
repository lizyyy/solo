from dataclasses import dataclass, field
from enum import Enum
from typing import List, Optional, Dict, Any
from datetime import datetime


class RecordSource(str, Enum):
    NORMAL = "normal"
    LATE_ATTACHMENT = "late_attachment"
    DUPLICATE = "duplicate"
    MANUAL_CORRECTION = "manual_correction"


class AnomalyType(str, Enum):
    TURN_ORDER_ERROR = "turn_order_error"
    BOUNDARY_CROSSING = "boundary_crossing"
    REPORT_SETTLEMENT_MISMATCH = "report_settlement_mismatch"
    SUSPECTED_DUPLICATE = "suspected_duplicate"


class ConfirmationStatus(str, Enum):
    CONFIRMED = "confirmed"
    PENDING = "pending"
    REJECTED = "rejected"


@dataclass
class Unit:
    unit_id: str
    name: str
    faction: str
    unit_type: str
    hp: int
    attack: int
    defense: int
    move_range: int
    source_file: str = ""
    line_number: int = 0


@dataclass
class Position:
    x: int
    y: int
    zone: str = ""


@dataclass
class BattleAction:
    action_id: str
    turn: int
    unit_id: str
    action_type: str
    start_pos: Position
    end_pos: Position
    timestamp: datetime
    target_unit_id: Optional[str] = None
    damage_dealt: Optional[int] = None
    result: Optional[str] = None


@dataclass
class AnomalyMark:
    anomaly_type: AnomalyType
    description: str
    confidence: float
    review_reason: str = ""
    evidence_refs: List[str] = field(default_factory=list)


@dataclass
class BattleRecord:
    record_id: str
    source: RecordSource
    battle_id: str
    round_number: int
    actions: List[BattleAction]
    raw_content: str
    source_file: str
    line_number: int
    anomalies: List[AnomalyMark] = field(default_factory=list)
    confirmation_status: ConfirmationStatus = ConfirmationStatus.CONFIRMED
    parent_correction_id: Optional[str] = None
    duplicate_of: Optional[str] = None
    received_at: datetime = field(default_factory=datetime.now)


@dataclass
class SettlementData:
    settlement_id: str
    battle_id: str
    round_number: int
    surviving_units: Dict[str, int]
    casualties: Dict[str, int]
    resource_changes: Dict[str, int]
    source_file: str
    line_number: int


@dataclass
class DecisionEntry:
    entry_id: str
    battle_id: str
    round_number: int
    conclusion: str
    wind_direction: str
    confidence_score: float
    confirmation_status: ConfirmationStatus
    contributing_records: List[str]
    contributing_units: List[str]
    anomalies_found: List[AnomalyType]
    review_notes: str = ""
    cross_refs: Dict[str, str] = field(default_factory=dict)


@dataclass
class BoundaryCrossingAnalysis:
    record_id: str
    action_id: str
    unit_id: str
    start_pos: Position
    end_pos: Position
    boundary_zones: List[str]
    crossing_detected: bool
    review_reason: str
    evidence: List[str]
    map_data_ref: str
    unit_move_ref: str
    confirmation_status: ConfirmationStatus

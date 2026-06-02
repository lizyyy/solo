from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any
from enum import Enum
from datetime import datetime


class SensitiveType(str, Enum):
    ID_CARD = "id_card"
    PHONE = "phone"
    NAME = "name"
    EMAIL = "email"
    ADDRESS = "address"
    BANK_CARD = "bank_card"
    OTHER = "other"


class DesensitizationLevel(str, Enum):
    FULL_MASK = "full_mask"
    PARTIAL_MASK = "partial_mask"
    REPLACEMENT = "replacement"
    NOT_MASKED = "not_masked"


class ErrorType(str, Enum):
    FALSE_NEGATIVE = "false_negative"
    FALSE_POSITIVE = "false_positive"
    WRONG_LEVEL = "wrong_level"
    MISMATCH_TYPE = "mismatch_type"
    CONFLICT = "conflict"


@dataclass
class ModelOutput:
    record_id: str
    model_version: str
    original_text: str
    masked_text: str
    detected_entities: List[Dict[str, Any]] = field(default_factory=list)
    timestamp: Optional[datetime] = None
    raw_log: Optional[str] = None


@dataclass
class Annotation:
    record_id: str
    sensitive_type: SensitiveType
    start_pos: int
    end_pos: int
    original_value: str
    expected_level: DesensitizationLevel
    comment: Optional[str] = None
    source: Optional[str] = None


@dataclass
class ThresholdConfig:
    sensitive_type: SensitiveType
    precision_threshold: float = 0.8
    recall_threshold: float = 0.8
    f1_threshold: float = 0.8
    description: Optional[str] = None


@dataclass
class Evidence:
    source_type: str
    source_id: str
    field: str
    value: Any
    link: Optional[str] = None


@dataclass
class ConflictCase:
    record_id: str
    conflict_type: ErrorType
    description: str
    evidences: List[Evidence] = field(default_factory=list)
    resolved: bool = False
    resolution_note: Optional[str] = None


@dataclass
class EvaluationResult:
    record_id: str
    sensitive_type: SensitiveType
    is_correct: bool
    error_type: Optional[ErrorType] = None
    model_level: Optional[DesensitizationLevel] = None
    expected_level: Optional[DesensitizationLevel] = None
    detected_value: Optional[str] = None
    expected_value: Optional[str] = None
    evidences: List[Evidence] = field(default_factory=list)
    note: Optional[str] = None
    eval_timestamp: datetime = field(default_factory=datetime.now)


@dataclass
class StratifiedGroup:
    group_key: str
    group_name: str
    total_count: int
    correct_count: int
    error_count: int
    error_types: Dict[str, int] = field(default_factory=dict)
    records: List[EvaluationResult] = field(default_factory=list)


@dataclass
class EvaluationSummary:
    model_version: str
    total_records: int
    correct_count: int
    error_count: int
    precision: float
    recall: float
    f1_score: float
    by_sensitive_type: Dict[str, StratifiedGroup] = field(default_factory=dict)
    by_error_type: Dict[str, StratifiedGroup] = field(default_factory=dict)
    conflicts: List[ConflictCase] = field(default_factory=list)
    notes: List[str] = field(default_factory=list)

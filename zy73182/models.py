from dataclasses import dataclass, field, asdict
from datetime import datetime
from typing import List, Dict, Optional, Any
from enum import Enum
import uuid


def _gen_id() -> str:
    return uuid.uuid4().hex[:12]


def _now() -> str:
    return datetime.now().isoformat(timespec="seconds")


class ProcessingStatus(str, Enum):
    RAW = "raw"
    NORMALIZED = "normalized"
    ATTRIBUTED = "attributed"
    REVIEWED = "reviewed"
    OVERRIDDEN = "overridden"
    COMPLETED = "completed"
    AMBIGUOUS = "ambiguous"


class OverrideSource(str, Enum):
    MANUAL = "manual"
    PARAM_RECALC = "param_recalc"
    BATCH_CORRECTION = "batch_correction"
    REFERENCE_MATERIAL = "reference_material"


class EvidenceGapLevel(str, Enum):
    MUST_FILL = "must_fill"
    SHOULD_FILL = "should_fill"
    OK_TO_PASS = "ok_to_pass"
    NICE_TO_HAVE = "nice_to_have"


class BoundaryEventType(str, Enum):
    EXTRAPOLATION = "extrapolation"
    OUT_OF_RANGE = "out_of_range"
    CLAMPED = "clamped"
    FORMULA_ADJUSTED = "formula_adjusted"


@dataclass
class FieldMappingRecord:
    source_field: str
    target_field: str
    confidence: float
    matched_at: str = field(default_factory=_now)
    mapping_rule: str = ""
    manual_override: bool = False


@dataclass
class StudentDraft:
    draft_id: str = field(default_factory=_gen_id)
    student_id: str = ""
    question_id: str = ""
    submit_time: str = field(default_factory=_now)
    raw_payload: Dict[str, Any] = field(default_factory=dict)
    field_mappings: List[FieldMappingRecord] = field(default_factory=list)
    normalized_data: Dict[str, Any] = field(default_factory=dict)
    processing_status: ProcessingStatus = ProcessingStatus.RAW
    raw_scratch_text: str = ""
    raw_chart_points: List[Dict[str, Any]] = field(default_factory=list)
    source_file: str = ""
    source_batch: str = ""
    version: int = 1
    created_at: str = field(default_factory=_now)
    updated_at: str = field(default_factory=_now)

    def to_dict(self):
        d = asdict(self)
        d["processing_status"] = self.processing_status.value
        return d


@dataclass
class BoundaryEvent:
    event_id: str = field(default_factory=_gen_id)
    draft_id: str = ""
    event_type: BoundaryEventType = BoundaryEventType.EXTRAPOLATION
    variable_name: str = ""
    input_value: float = 0.0
    valid_min: Optional[float] = None
    valid_max: Optional[float] = None
    clamped_value: Optional[float] = None
    original_claim_text: str = ""
    formula_used: str = ""
    units: str = ""
    impact_severity: float = 0.0
    attribution_run_id: str = ""
    detected_at: str = field(default_factory=_now)

    def to_dict(self):
        d = asdict(self)
        d["event_type"] = self.event_type.value
        return d


@dataclass
class FormulaTrace:
    variable: str
    formula: str
    unit: str
    input_values: Dict[str, float]
    output_value: float
    boundary_sample: bool = False
    boundary_rationale: str = ""


@dataclass
class AttributionResult:
    attribution_id: str = field(default_factory=_gen_id)
    draft_id: str = ""
    run_id: str = ""
    config_id: str = ""
    error_category: str = ""
    error_subcategory: str = ""
    confidence_score: float = 0.0
    severity: float = 0.0
    formula_traces: List[FormulaTrace] = field(default_factory=list)
    supporting_evidence: List[Dict[str, Any]] = field(default_factory=list)
    chart_clickthrough: List[Dict[str, Any]] = field(default_factory=list)
    boundary_events: List[str] = field(default_factory=list)
    generated_at: str = field(default_factory=_now)
    is_latest: bool = True
    delta_from_previous: Optional[Dict[str, Any]] = None

    def to_dict(self):
        return asdict(self)


@dataclass
class OverrideRecord:
    override_id: str = field(default_factory=_gen_id)
    draft_id: str = ""
    attribution_id: str = ""
    previous_category: str = ""
    new_category: str = ""
    previous_confidence: float = 0.0
    new_confidence: float = 0.0
    operator: str = ""
    source: OverrideSource = OverrideSource.MANUAL
    reason: str = ""
    reference_material_id: str = ""
    previous_status: ProcessingStatus = ProcessingStatus.ATTRIBUTED
    new_status: ProcessingStatus = ProcessingStatus.OVERRIDDEN
    created_at: str = field(default_factory=_now)

    def to_dict(self):
        d = asdict(self)
        d["source"] = self.source.value
        d["previous_status"] = self.previous_status.value
        d["new_status"] = self.new_status.value
        return d


@dataclass
class AttributionConfig:
    config_id: str = field(default_factory=_gen_id)
    config_name: str = "default"
    version: int = 1
    thresholds: Dict[str, float] = field(default_factory=lambda: {
        "conceptual_error_weight": 0.6,
        "calculation_error_weight": 0.4,
        "confidence_floor": 0.3,
        "extrapolation_penalty": 0.25,
        "boundary_sample_margin": 0.05,
    })
    category_rules: Dict[str, Any] = field(default_factory=dict)
    valid_ranges: Dict[str, Dict[str, float]] = field(default_factory=dict)
    formulas: Dict[str, str] = field(default_factory=dict)
    units: Dict[str, str] = field(default_factory=dict)
    field_synonyms: Dict[str, List[str]] = field(default_factory=lambda: {
        "student_name": ["姓名", "学生姓名", "name", "student_name"],
        "question_number": ["题号", "题目编号", "q_num", "question_no"],
        "answer_value": ["答案", "作答值", "答案值", "ans", "result"],
        "steps": ["步骤", "解题步骤", "steps", "process"],
        "chart_data": ["图表数据", "图示点", "chart", "points"],
        "scratch_text": ["草稿", "草稿内容", "scratch", "notes"],
    })
    created_at: str = field(default_factory=_now)
    created_by: str = "system"

    def to_dict(self):
        return asdict(self)


@dataclass
class RecalculationDiff:
    variable: str
    old_value: Any
    new_value: Any
    changed_by_formula: bool
    changed_by_threshold: bool
    boundary_sample_involved: bool
    unit: str
    rationale: str


@dataclass
class RecalculationReport:
    report_id: str = field(default_factory=_gen_id)
    old_config_id: str = ""
    new_config_id: str = ""
    affected_draft_count: int = 0
    category_changes: Dict[str, int] = field(default_factory=dict)
    boundary_driven_changes: int = 0
    formula_driven_changes: int = 0
    per_draft_diffs: Dict[str, List[RecalculationDiff]] = field(default_factory=dict)
    generated_at: str = field(default_factory=_now)


@dataclass
class EvidenceGap:
    gap_id: str = field(default_factory=_gen_id)
    draft_id: str = ""
    gap_type: str = ""
    gap_description: str = ""
    level: EvidenceGapLevel = EvidenceGapLevel.SHOULD_FILL
    related_category: str = ""
    fill_suggestion: str = ""
    blocking_release: bool = False
    resolved: bool = False
    resolved_by: str = ""
    resolved_at: Optional[str] = None
    created_at: str = field(default_factory=_now)

    def to_dict(self):
        d = asdict(self)
        d["level"] = self.level.value
        return d


@dataclass
class AuditLogEntry:
    log_id: str = field(default_factory=_gen_id)
    entity_type: str = ""
    entity_id: str = ""
    action: str = ""
    operator: str = ""
    before: Dict[str, Any] = field(default_factory=dict)
    after: Dict[str, Any] = field(default_factory=dict)
    timestamp: str = field(default_factory=_now)
    source_ip: str = ""
    comment: str = ""

    def to_dict(self):
        return asdict(self)

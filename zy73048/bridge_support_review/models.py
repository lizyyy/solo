from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional, Any
from uuid import uuid4


class JudgmentType(Enum):
    PASS = "PASS"
    SUPPLEMENT = "SUPPLEMENT"
    HANG = "HANG"
    REJECT = "REJECT"


class VersionLayer(Enum):
    ORIGINAL = "ORIGINAL"
    REMARK_PATCHED = "REMARK_PATCHED"
    LATEST_EXPORT = "LATEST_EXPORT"


class StepName(Enum):
    MATERIAL_VALIDATION = "MATERIAL_VALIDATION"
    PART_MATCHING = "PART_MATCHING"
    ALARM_RECONCILIATION = "ALARM_RECONCILIATION"
    REMARK_INJECTION = "REMARK_INJECTION"
    FINAL_JUDGMENT = "FINAL_JUDGMENT"


@dataclass
class SparePartRow:
    row_id: str
    part_no: str
    part_name: str
    spec_model: str
    quantity: int
    supplier: str
    warehouse_status: str
    remark: str = ""
    manual_note: str = ""
    is_substituted: bool = False
    original_part_no: Optional[str] = None
    source_layer: VersionLayer = VersionLayer.ORIGINAL
    data_hash: str = ""

    def compute_hash(self) -> str:
        payload = (
            f"{self.part_no}|{self.part_name}|{self.spec_model}|{self.quantity}|"
            f"{self.supplier}|{self.warehouse_status}|{self.remark}|{self.manual_note}|"
            f"{self.is_substituted}|{self.original_part_no}"
        )
        import hashlib
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:16]


@dataclass
class AlarmRecord:
    alarm_id: str
    part_no: str
    alarm_type: str
    alarm_level: str
    alarm_content: str
    triggered_at: datetime
    resolved: bool = False
    resolved_note: str = ""


@dataclass
class ReviewParameters:
    param_id: str = field(default_factory=lambda: f"P-{uuid4().hex[:8]}")
    allow_partial_match: bool = True
    require_supplier_cert: bool = True
    strict_substitution_check: bool = True
    min_warehouse_ratio: float = 0.8
    remark_weight: float = 0.5
    created_at: datetime = field(default_factory=datetime.now)

    def fingerprint(self) -> str:
        payload = (
            f"{self.allow_partial_match}|{self.require_supplier_cert}|"
            f"{self.strict_substitution_check}|{self.min_warehouse_ratio}|"
            f"{self.remark_weight}"
        )
        import hashlib
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:12]


@dataclass
class RowJudgment:
    row_id: str
    judgment: JudgmentType
    reason_codes: List[str]
    affected_by: List[str]
    detail: str = ""


@dataclass
class StepSnapshot:
    step: StepName
    param_fingerprint: str
    row_judgments: Dict[str, RowJudgment]
    summary: Dict[str, Any]
    created_at: datetime = field(default_factory=datetime.now)


@dataclass
class ParameterChangeImpact:
    changed_field: str
    old_value: Any
    new_value: Any
    affected_steps: List[StepName]
    flipped_rows: List[str]
    flip_detail: List[Dict[str, str]]


@dataclass
class RemarkPatchImpact:
    patched_row_ids: List[str]
    before_judgments: Dict[str, JudgmentType]
    after_judgments: Dict[str, JudgmentType]
    flipped_count: int
    description: str = ""


@dataclass
class HangEvent:
    hang_id: str
    row_id: str
    reason: str
    substitution_detail: Dict[str, Any]
    require_confirm_from: str = "算法值班人"
    created_at: datetime = field(default_factory=datetime.now)
    confirmed: bool = False
    confirmed_by: Optional[str] = None
    confirmed_at: Optional[datetime] = None


@dataclass
class ReviewResult:
    review_id: str
    param_fingerprint: str
    parameters: ReviewParameters
    snapshots: List[StepSnapshot]
    final_judgments: Dict[str, RowJudgment]
    hang_events: List[HangEvent]
    remark_patch_impact: Optional[RemarkPatchImpact]
    parameter_change_impact: Optional[ParameterChangeImpact]
    export_layer: VersionLayer
    generated_at: datetime = field(default_factory=datetime.now)

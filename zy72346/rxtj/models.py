from __future__ import annotations

import uuid
from dataclasses import dataclass, field, asdict
from datetime import datetime
from typing import Optional, Any

from .rules import ReviewStatus, AnnotationSource, DenominatorZeroPolicy, ConflictResolution


@dataclass
class Annotation:
    id: str = field(default_factory=lambda: uuid.uuid4().hex[:12])
    source: AnnotationSource = AnnotationSource.TEACHER_ANNOTATION
    original_line_number: int = 0
    original_value: str = ""
    current_value: str = ""
    item_name: str = ""
    category: str = ""
    denominator_raw: str = ""
    numerator_raw: str = ""
    is_edge_case: bool = False
    edge_case_type: Optional[str] = None
    status: ReviewStatus = ReviewStatus.PENDING
    import_batch_id: str = ""
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now().isoformat())

    @property
    def denominator_is_zero_or_empty(self) -> bool:
        val = self.denominator_raw.strip()
        if val == "" or val == "0" or val == "0.0":
            return True
        try:
            return float(val) == 0
        except ValueError:
            return val == ""

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: dict) -> Annotation:
        d = dict(d)
        if "source" in d and isinstance(d["source"], str):
            d["source"] = AnnotationSource(d["source"])
        if "status" in d and isinstance(d["status"], str):
            d["status"] = ReviewStatus(d["status"])
        return cls(**{k: v for k, v in d.items() if k in cls.__dataclass_fields__})


@dataclass
class ChangeRecord:
    id: str = field(default_factory=lambda: uuid.uuid4().hex[:12])
    annotation_id: str = ""
    field_name: str = ""
    old_value: str = ""
    new_value: str = ""
    changed_by: str = ""
    reason: str = ""
    import_batch_id: str = ""
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: dict) -> ChangeRecord:
        return cls(**{k: v for k, v in d.items() if k in cls.__dataclass_fields__})


@dataclass
class ImportBatch:
    id: str = field(default_factory=lambda: uuid.uuid4().hex[:12])
    source: AnnotationSource = AnnotationSource.TEACHER_ANNOTATION
    total_rows: int = 0
    new_count: int = 0
    unchanged_count: int = 0
    changed_count: int = 0
    skipped_duplicate_count: int = 0
    flagged_count: int = 0
    rolled_back: bool = False
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: dict) -> ImportBatch:
        d = dict(d)
        if "source" in d and isinstance(d["source"], str):
            d["source"] = AnnotationSource(d["source"])
        return cls(**{k: v for k, v in d.items() if k in cls.__dataclass_fields__})


@dataclass
class EvidenceSummary:
    annotation_id: str = ""
    original_line_number: int = 0
    original_value: str = ""
    current_value: str = ""
    source: AnnotationSource = AnnotationSource.TEACHER_ANNOTATION
    is_edge_case: bool = False
    edge_case_type: Optional[str] = None
    status: ReviewStatus = ReviewStatus.PENDING
    annotation_content: str = ""
    sampling_list_value: str = ""
    conflict_resolution: Optional[str] = None
    change_count: int = 0
    last_changed_by: str = ""
    last_changed_reason: str = ""

    def to_dict(self) -> dict:
        d = asdict(self)
        for k, v in d.items():
            if isinstance(v, AnnotationSource):
                d[k] = v.value
            elif isinstance(v, ReviewStatus):
                d[k] = v.value
        return d


@dataclass
class CalculationResult:
    item_name: str = ""
    category: str = ""
    value: Optional[float] = None
    denominator: float = 0.0
    numerator: float = 0.0
    was_edge_case: bool = False
    edge_case_type: Optional[str] = None
    status: ReviewStatus = ReviewStatus.PENDING
    evidence: Optional[EvidenceSummary] = None

    def to_dict(self) -> dict:
        d = asdict(self)
        if self.evidence:
            d["evidence"] = self.evidence.to_dict()
        for k, v in d.items():
            if isinstance(v, ReviewStatus):
                d[k] = v.value
        return d

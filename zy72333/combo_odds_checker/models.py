from __future__ import annotations

import enum
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional


class SampleStatus(enum.Enum):
    NORMAL = "normal"
    NEGATIVE_TREATED_AS_MISSING = "negative_treated_as_missing"
    PENDING_TA_REVIEW = "pending_ta_review"
    CORRECTED = "corrected"


class NextContact(enum.Enum):
    STUDENT_TA = "学生助教"
    COURSE_DIRECTOR_WU = "教研负责人吴老师"


@dataclass
class WeightEntry:
    row_id: int
    category: str
    weight: float
    raw_value: Optional[float]
    is_negative: bool = False
    old_table_treats_as_missing: bool = False
    note: str = ""


@dataclass
class ScoringWeightTable:
    table_id: str
    entries: list[WeightEntry] = field(default_factory=list)
    source: str = ""
    imported_at: datetime = field(default_factory=datetime.now)


@dataclass
class OldFormulaScreenshot:
    screenshot_id: str
    description: str
    image_ref: str
    related_category: str
    uploaded_at: datetime = field(default_factory=datetime.now)
    uploaded_by: str = ""


@dataclass
class BoundarySample:
    sample_id: str
    entry: WeightEntry
    status: SampleStatus = SampleStatus.NORMAL
    reason_kept: str = ""
    missing_materials: list[str] = field(default_factory=list)
    next_contact: NextContact = NextContact.STUDENT_TA
    linked_screenshots: list[str] = field(default_factory=list)
    corrected_at: Optional[datetime] = None


@dataclass
class BoundarySampleReport:
    report_id: str
    generated_at: datetime = field(default_factory=datetime.now)
    samples: list[BoundarySample] = field(default_factory=list)
    summary: str = ""

    @property
    def pending_ta_count(self) -> int:
        return sum(1 for s in self.samples if s.status == SampleStatus.PENDING_TA_REVIEW)

    @property
    def negative_as_missing_count(self) -> int:
        return sum(1 for s in self.samples if s.status == SampleStatus.NEGATIVE_TREATED_AS_MISSING)

    @property
    def corrected_count(self) -> int:
        return sum(1 for s in self.samples if s.status == SampleStatus.CORRECTED)


@dataclass
class ManualCorrection:
    correction_id: str
    sample_id: str
    old_value: float
    new_value: float
    reason: str
    corrected_by: str = ""
    corrected_at: datetime = field(default_factory=datetime.now)


@dataclass
class RerunRecord:
    rerun_id: str
    triggered_at: datetime = field(default_factory=datetime.now)
    corrections_applied: list[str] = field(default_factory=list)
    report_before: str = ""
    report_after: str = ""

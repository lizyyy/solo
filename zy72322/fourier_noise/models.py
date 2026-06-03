from dataclasses import dataclass, field
from enum import Enum
from typing import Optional, List, Dict, Any
import numpy as np


class RecordType(Enum):
    NORMAL = "normal"
    NEGATIVE_AS_MISSING = "negative_as_missing"
    SUPPLEMENTED_FROM_SAMPLING = "supplemented_from_sampling"


class ReviewStatus(Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    REJECTED = "rejected"


@dataclass
class Record:
    id: str
    timestamp: float
    value: float
    old_table_value: Optional[float]
    record_type: RecordType
    teacher_annotation: Optional[str] = None
    sampling_list_source: Optional[str] = None
    review_status: ReviewStatus = ReviewStatus.PENDING
    corrected_value: Optional[float] = None
    fourier_periodic: Optional[Any] = None
    fourier_noise: Optional[Any] = None

    def to_dict(self) -> Dict[str, Any]:
        d = {
            "id": self.id,
            "timestamp": self.timestamp,
            "value": self.value,
            "old_table_value": self.old_table_value,
            "record_type": self.record_type.value,
            "review_status": self.review_status.value,
        }
        if self.teacher_annotation is not None:
            d["teacher_annotation"] = self.teacher_annotation
        if self.sampling_list_source is not None:
            d["sampling_list_source"] = self.sampling_list_source
        if self.corrected_value is not None:
            d["corrected_value"] = self.corrected_value
        if self.fourier_periodic is not None:
            d["fourier_periodic"] = [round(float(v), 4) for v in self.fourier_periodic]
        if self.fourier_noise is not None:
            d["fourier_noise"] = [round(float(v), 4) for v in self.fourier_noise]
        return d


@dataclass
class TeacherAnnotation:
    record_id: str
    annotation: str
    annotated_by: str
    timestamp: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "record_id": self.record_id,
            "annotation": self.annotation,
            "annotated_by": self.annotated_by,
            "timestamp": self.timestamp,
        }


@dataclass
class SamplingEntry:
    record_id: str
    old_caliber_value: float
    source: str
    notes: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        d = {
            "record_id": self.record_id,
            "old_caliber_value": self.old_caliber_value,
            "source": self.source,
        }
        if self.notes is not None:
            d["notes"] = self.notes
        return d


@dataclass
class BoundarySampleReport:
    total_records: int
    normal_count: int
    negative_as_missing_count: int
    supplemented_count: int
    pending_review_count: int
    confirmed_count: int
    rejected_count: int
    records: List[Dict[str, Any]]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "total_records": self.total_records,
            "normal_count": self.normal_count,
            "negative_as_missing_count": self.negative_as_missing_count,
            "supplemented_count": self.supplemented_count,
            "pending_review_count": self.pending_review_count,
            "confirmed_count": self.confirmed_count,
            "rejected_count": self.rejected_count,
            "records": self.records,
        }

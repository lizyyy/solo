from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime
from typing import Optional


class RecordStatus(Enum):
    NORMAL = "正常"
    GAP_PENDING_REVIEW = "断档待复核"
    SUPPLEMENTED_OLD_CALIBER = "补录旧口径"


@dataclass
class Segment:
    seg_no: int
    lower: float
    upper: float
    discount_rate: float

    def contains(self, score: float) -> bool:
        if self.lower == float("-inf"):
            return score < self.upper
        if self.upper == float("inf"):
            return score >= self.lower
        return self.lower <= score < self.upper

    def apply(self, original_price: float) -> float:
        return round(original_price * self.discount_rate, 2)


@dataclass
class PiecewiseFunction:
    name: str
    segments: list[Segment] = field(default_factory=list)

    def sorted_segments(self) -> list[Segment]:
        return sorted(self.segments, key=lambda s: s.seg_no)

    def find_segment(self, score: float) -> Optional[Segment]:
        for seg in self.sorted_segments():
            if seg.contains(score):
                return seg
        return None

    def apply(self, score: float, original_price: float) -> tuple[Optional[Segment], float]:
        seg = self.find_segment(score)
        if seg is None:
            return None, original_price
        return seg, seg.apply(original_price)


@dataclass
class WeightEntry:
    dimension: str
    weight: float
    score: float

    @property
    def weighted_score(self) -> float:
        return round(self.weight * self.score, 4)


@dataclass
class ScoringWeightTable:
    name: str
    entries: list[WeightEntry] = field(default_factory=list)
    version: int = 1
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    is_supplemented: bool = False

    def total_weighted_score(self) -> float:
        return round(sum(e.weighted_score for e in self.entries), 4)

    def total_weight(self) -> float:
        return round(sum(e.weight for e in self.entries), 4)


@dataclass
class BoundaryNote:
    boundary: str
    explanation: str
    import_batch: str


@dataclass
class CalculationRecord:
    record_id: str
    original_price: float
    score: float
    function_name: str
    weight_table_name: str
    weight_table_version: int
    seg_no: Optional[int]
    discount_rate: Optional[float]
    final_price: float
    status: RecordStatus = RecordStatus.NORMAL
    gap_detail: Optional[str] = None
    remark: str = ""
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())

    def summary_line(self) -> str:
        parts = [
            f"[{self.record_id}]",
            f"原价={self.original_price}",
            f"综合评分={self.score}",
            f"分段={self.seg_no}",
            f"折扣率={self.discount_rate}",
            f"实付={self.final_price}",
            f"状态={self.status.value}",
        ]
        if self.gap_detail:
            parts.append(f"断档={self.gap_detail}")
        if self.remark:
            parts.append(f"备注={self.remark}")
        return " | ".join(parts)


@dataclass
class ParameterVersion:
    version: int
    weight_table_name: str
    entries_snapshot: list[WeightEntry]
    is_supplemented: bool
    created_at: str
    remark: str = ""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from .models import PiecewiseFunction, Segment, RecordStatus


@dataclass
class GapResult:
    has_gap: bool
    missing_nos: list[int]
    detail: Optional[str]

    def format_detail(self) -> str:
        if not self.has_gap:
            return ""
        return f"缺失编号 {self.missing_nos}，待教研组复核"


class GapDetector:
    """
    检查分段函数的编号是否连续。
    人工删行会导致编号跳号（比如 1,2,4,5 缺了 3），
    此时不要自动修复，而是标为「断档待复核」，留给教研组判断。
    """

    def detect(self, func: PiecewiseFunction) -> GapResult:
        if not func.segments:
            return GapResult(has_gap=False, missing_nos=[], detail=None)

        sorted_segs = func.sorted_segments()
        nos = [s.seg_no for s in sorted_segs]

        expected = list(range(nos[0], nos[-1] + 1))
        missing = [n for n in expected if n not in nos]

        if not missing:
            return GapResult(has_gap=False, missing_nos=[], detail=None)

        detail = GapResult(has_gap=True, missing_nos=missing, detail=None)
        detail.detail = detail.format_detail()
        return detail

    def check_and_mark(
        self,
        func: PiecewiseFunction,
        seg_no: Optional[int],
    ) -> tuple[RecordStatus, Optional[str]]:
        gap = self.detect(func)

        if not gap.has_gap:
            return RecordStatus.NORMAL, None

        if seg_no is not None and seg_no in gap.missing_nos:
            return (
                RecordStatus.GAP_PENDING_REVIEW,
                f"编号 {seg_no} 已被人工删除，{gap.format_detail()}",
            )

        if gap.has_gap:
            return (
                RecordStatus.GAP_PENDING_REVIEW,
                gap.detail,
            )

        return RecordStatus.NORMAL, None

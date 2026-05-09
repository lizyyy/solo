from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional

from ..models.voucher import Voucher, VoucherBatch, VoucherType


@dataclass
class GapIssue:
    voucher_type: VoucherType
    missing_number: int
    expected_sequence: int
    previous_voucher: Optional[Voucher] = None
    next_voucher: Optional[Voucher] = None
    detail: str = ""


@dataclass
class GapAnalysis:
    issues: List[GapIssue] = field(default_factory=list)
    type_stats: Dict[VoucherType, Dict] = field(default_factory=dict)

    def has_issues(self) -> bool:
        return len(self.issues) > 0


class GapDetector:
    def analyze(self, batch: VoucherBatch) -> GapAnalysis:
        analysis = GapAnalysis()
        groups = batch.group_by_type()

        for vtype, vouchers in groups.items():
            if not vouchers:
                continue

            sorted_vouchers = sorted(vouchers, key=lambda x: x.number_sequence)
            sequences = [v.number_sequence for v in sorted_vouchers]

            analysis.type_stats[vtype] = {
                "count": len(sorted_vouchers),
                "min": min(sequences) if sequences else 0,
                "max": max(sequences) if sequences else 0,
            }

            expected = sequences[0]
            for i, voucher in enumerate(sorted_vouchers):
                actual = voucher.number_sequence
                if actual > expected:
                    for missing in range(expected, actual):
                        prev = sorted_vouchers[i - 1] if i > 0 else None
                        next_v = voucher
                        analysis.issues.append(
                            GapIssue(
                                voucher_type=vtype,
                                missing_number=missing,
                                expected_sequence=expected,
                                previous_voucher=prev,
                                next_voucher=next_v,
                                detail=self._build_detail(missing, prev, next_v),
                            )
                        )
                expected = actual + 1

        return analysis

    def _build_detail(
        self,
        missing: int,
        prev: Optional[Voucher],
        next_v: Optional[Voucher],
    ) -> str:
        parts = []
        if prev:
            parts.append(
                f"前一凭证: {prev.voucher_type.value}{prev.voucher_number} "
                f"(行 {prev.line_number})"
            )
        if next_v:
            parts.append(
                f"后一凭证: {next_v.voucher_type.value}{next_v.voucher_number} "
                f"(行 {next_v.line_number})"
            )
        return " | ".join(parts)

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Tuple

from ..models.voucher import Voucher, VoucherBatch, VoucherType


@dataclass
class DuplicateIssue:
    voucher_type: VoucherType
    voucher_number: str
    number_sequence: int
    vouchers: List[Voucher] = field(default_factory=list)

    @property
    def count(self) -> int:
        return len(self.vouchers)

    def get_sources(self) -> List[str]:
        return [
            f"{v.source_file}:{v.line_number}" for v in self.vouchers
        ]


@dataclass
class DuplicateAnalysis:
    issues: List[DuplicateIssue] = field(default_factory=list)
    total_duplicates: int = 0

    def has_issues(self) -> bool:
        return len(self.issues) > 0


class DuplicateDetector:
    def analyze(self, batch: VoucherBatch) -> DuplicateAnalysis:
        analysis = DuplicateAnalysis()
        groups = batch.group_by_type()

        for vtype, vouchers in groups.items():
            seq_map: Dict[int, List[Voucher]] = {}
            for v in vouchers:
                seq_map.setdefault(v.number_sequence, []).append(v)

            for seq, dups in seq_map.items():
                if len(dups) > 1:
                    issue = DuplicateIssue(
                        voucher_type=vtype,
                        voucher_number=dups[0].voucher_number,
                        number_sequence=seq,
                        vouchers=dups,
                    )
                    analysis.issues.append(issue)
                    analysis.total_duplicates += len(dups) - 1

        return analysis

    def find_by_type_and_number(
        self,
        batch: VoucherBatch,
        vtype: VoucherType,
        number: str,
    ) -> List[Voucher]:
        result = []
        for v in batch.vouchers:
            if v.voucher_type == vtype and v.voucher_number == number:
                result.append(v)
        return result

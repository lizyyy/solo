from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional, Tuple

from ..models.voucher import Voucher, VoucherBatch, VoucherStatus, VoucherType


@dataclass
class ReversePair:
    original: Voucher
    reversal: Voucher
    confidence: float = 0.0
    matched_by: str = ""
    date_diff_days: int = 0


@dataclass
class UnmatchedReversal:
    voucher: Voucher
    reason: str
    possible_matches: List[Voucher] = field(default_factory=list)


@dataclass
class ReverseAnalysis:
    pairs: List[ReversePair] = field(default_factory=list)
    unmatched_originals: List[Voucher] = field(default_factory=list)
    unmatched_reversals: List[UnmatchedReversal] = field(default_factory=list)

    def has_issues(self) -> bool:
        return len(self.unmatched_reversals) > 0


class ReverseMatcher:
    def __init__(self, description_keywords: Optional[List[str]] = None):
        self.reversal_keywords = description_keywords or [
            "冲销",
            "红冲",
            "红字",
            "作废",
            "reversal",
            "reverse",
        ]

    def analyze(self, batch: VoucherBatch) -> ReverseAnalysis:
        analysis = ReverseAnalysis()
        all_vouchers = list(batch.vouchers)

        candidates, non_candidates = self._classify_vouchers(all_vouchers)

        if not candidates["possible_reversals"]:
            return analysis

        pairs, unmatched = self._match_pairs(
            candidates["possible_reversals"],
            candidates["possible_originals"] + non_candidates,
        )

        analysis.pairs = pairs

        for v in unmatched["reversals"]:
            analysis.unmatched_reversals.append(
                UnmatchedReversal(
                    voucher=v,
                    reason="未找到对应的原凭证",
                    possible_matches=self._find_possible_matches(v, non_candidates),
                )
            )

        self._mark_status(analysis)
        return analysis

    def _classify_vouchers(
        self, vouchers: List[Voucher]
    ) -> Tuple[Dict[str, List[Voucher]], List[Voucher]]:
        possible_reversals: List[Voucher] = []
        possible_originals: List[Voucher] = []
        others: List[Voucher] = []

        for v in vouchers:
            desc = (v.description or "").lower()
            if any(kw.lower() in desc for kw in self.reversal_keywords):
                possible_reversals.append(v)
            elif self._has_negative_amounts(v):
                possible_reversals.append(v)
            else:
                others.append(v)

        return (
            {
                "possible_reversals": possible_reversals,
                "possible_originals": possible_originals,
            },
            others,
        )

    def _has_negative_amounts(self, voucher: Voucher) -> bool:
        for e in voucher.entries:
            if e.debit < 0 or e.credit < 0:
                return True
        return False

    def _match_pairs(
        self, reversals: List[Voucher], originals: List[Voucher]
    ) -> Tuple[List[ReversePair], Dict[str, List[Voucher]]]:
        pairs: List[ReversePair] = []
        matched_original_ids: set = set()
        matched_reversal_ids: set = set()

        for rev in reversals:
            if rev.id in matched_reversal_ids:
                continue

            best_match: Optional[Voucher] = None
            best_score = 0.0
            best_method = ""

            for orig in originals:
                if orig.id in matched_original_ids:
                    continue

                score, method = self._calculate_match_score(rev, orig)
                if score > best_score:
                    best_score = score
                    best_match = orig
                    best_method = method

            if best_match and best_score >= 0.7:
                date_diff = (rev.voucher_date - best_match.voucher_date).days
                pairs.append(
                    ReversePair(
                        original=best_match,
                        reversal=rev,
                        confidence=best_score,
                        matched_by=best_method,
                        date_diff_days=date_diff,
                    )
                )
                matched_original_ids.add(best_match.id)
                matched_reversal_ids.add(rev.id)

        unmatched = {
            "reversals": [r for r in reversals if r.id not in matched_reversal_ids],
            "originals": [o for o in originals if o.id not in matched_original_ids],
        }

        return pairs, unmatched

    def _calculate_match_score(
        self, rev: Voucher, orig: Voucher
    ) -> Tuple[float, str]:
        if rev.voucher_type != orig.voucher_type:
            return 0.0, ""

        if rev.is_possible_reversal_of(orig):
            return 1.0, "exact_entry_match"

        if len(rev.entries) == len(orig.entries):
            account_match = all(
                r.account_code == o.account_code
                for r, o in zip(rev.entries, orig.entries)
            )
            if account_match:
                return 0.8, "account_match"

        rev_desc = (rev.description or "").lower()
        orig_desc = (orig.description or "").lower()
        if orig_desc and orig_desc in rev_desc:
            return 0.5, "description_contains"

        return 0.0, ""

    def _find_possible_matches(
        self, reversal: Voucher, pool: List[Voucher]
    ) -> List[Voucher]:
        matches: List[Tuple[Voucher, float]] = []
        for v in pool:
            score, _ = self._calculate_match_score(reversal, v)
            if score > 0.3:
                matches.append((v, score))
        matches.sort(key=lambda x: x[1], reverse=True)
        return [m[0] for m in matches[:5]]

    def _mark_status(self, analysis: ReverseAnalysis):
        for pair in analysis.pairs:
            pair.original.status = VoucherStatus.REVERSED
            pair.original.related_reversal_id = pair.reversal.id
            pair.reversal.status = VoucherStatus.REVERSAL
            pair.reversal.related_original_id = pair.original.id

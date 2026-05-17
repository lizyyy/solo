from typing import List, Dict
from collections import defaultdict
from datetime import datetime
from models import (
    MatchResult, MatchStatus, DiscrepancyReason,
    ReconciliationSummary, ReconciliationResult, SourceLocation,
    Transaction
)


class DiscrepancyAnalyzer:
    def __init__(self):
        pass

    def _classify_discrepancy(self, result: MatchResult) -> DiscrepancyReason:
        if result.status != MatchStatus.UNMATCHED:
            return result.discrepancy_reason or DiscrepancyReason.UNKNOWN

        cash_tx = result.cash_register_tx
        payment_tx = result.payment_gateway_tx

        if cash_tx and not payment_tx:
            return DiscrepancyReason.MISSING_IN_PAYMENT_GATEWAY
        elif payment_tx and not cash_tx:
            return DiscrepancyReason.MISSING_IN_CASH_REGISTER

        if cash_tx and payment_tx:
            if cash_tx.store_id != payment_tx.store_id:
                return DiscrepancyReason.STORE_MISMATCH
            if abs(cash_tx.amount - payment_tx.amount) > 0.01:
                return DiscrepancyReason.AMOUNT_MISMATCH

        return DiscrepancyReason.UNKNOWN

    def analyze(
        self,
        matches: List[MatchResult],
        cash_register_count: int,
        payment_gateway_count: int,
        bad_rows: List[SourceLocation],
        duplicates: List[Transaction],
        start_time: float,
        end_time: float
    ) -> ReconciliationResult:
        matched_count = sum(1 for m in matches if m.status == MatchStatus.MATCHED)
        unmatched_count = sum(1 for m in matches if m.status == MatchStatus.UNMATCHED)
        duplicate_count = sum(1 for m in matches if m.status == MatchStatus.DUPLICATE)

        discrepancy_breakdown: Dict[DiscrepancyReason, int] = defaultdict(int)
        for match in matches:
            if match.discrepancy_reason:
                discrepancy_breakdown[match.discrepancy_reason] += 1
            elif match.status == MatchStatus.UNMATCHED:
                reason = self._classify_discrepancy(match)
                discrepancy_breakdown[reason] += 1

        summary = ReconciliationSummary(
            total_cash_register=cash_register_count,
            total_payment_gateway=payment_gateway_count,
            matched_count=matched_count,
            unmatched_count=unmatched_count,
            duplicate_count=duplicate_count,
            bad_row_count=len(bad_rows),
            discrepancy_breakdown=dict(discrepancy_breakdown),
            processing_time=end_time - start_time
        )

        return ReconciliationResult(
            matches=matches,
            summary=summary,
            bad_rows=bad_rows,
            generated_at=datetime.now()
        )

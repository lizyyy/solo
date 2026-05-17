from datetime import timedelta
from typing import List, Dict, Tuple, Set
from collections import defaultdict
from models import (
    Transaction, TransactionType, MatchResult, MatchStatus,
    DiscrepancyReason
)
from config import AppConfig


class TransactionMatcher:
    def __init__(self, config: AppConfig):
        self.config = config
        self.duplicate_hashes: Set[str] = set()

    def _get_transaction_hash(self, tx: Transaction) -> str:
        return f"{tx.store_id}_{tx.amount}_{tx.transaction_time.isoformat()}_{tx.transaction_type.value}"

    def _is_amount_match(self, amount1: float, amount2: float) -> bool:
        return abs(amount1 - amount2) <= self.config.matching.amount_tolerance

    def _is_time_match(self, time1, time2, window_minutes: int) -> bool:
        diff = abs((time1 - time2).total_seconds())
        return diff <= (window_minutes * 60)

    def _find_duplicates(self, transactions: List[Transaction]) -> Tuple[List[Transaction], List[Transaction]]:
        if not self.config.matching.enable_duplicate_detection:
            return transactions, []

        seen = {}
        unique = []
        duplicates = []

        for tx in transactions:
            tx_hash = self._get_transaction_hash(tx)
            if tx_hash in seen:
                duplicates.append(tx)
            else:
                seen[tx_hash] = tx
                unique.append(tx)

        return unique, duplicates

    def _group_by_store(self, transactions: List[Transaction]) -> Dict[str, List[Transaction]]:
        grouped = defaultdict(list)
        for tx in transactions:
            grouped[tx.store_id].append(tx)
        return dict(grouped)

    def _match_payments(
        self,
        cash_txs: List[Transaction],
        payment_txs: List[Transaction]
    ) -> List[MatchResult]:
        results: List[MatchResult] = []
        cash_matched: Set[str] = set()
        payment_matched: Set[str] = set()

        cash_by_order: Dict[str, List[Transaction]] = defaultdict(list)
        for tx in cash_txs:
            if tx.order_no:
                cash_by_order[tx.order_no].append(tx)

        payment_by_order: Dict[str, List[Transaction]] = defaultdict(list)
        for tx in payment_txs:
            if tx.order_no:
                payment_by_order[tx.order_no].append(tx)

        for order_no in cash_by_order:
            if order_no in payment_by_order:
                cash_list = cash_by_order[order_no]
                payment_list = payment_by_order[order_no]
                for cash_tx in cash_list:
                    for payment_tx in payment_list:
                        if (cash_tx.transaction_id in cash_matched or
                            payment_tx.transaction_id in payment_matched):
                            continue
                        if self._is_amount_match(cash_tx.amount, payment_tx.amount):
                            if self._is_time_match(
                                cash_tx.transaction_time,
                                payment_tx.transaction_time,
                                self.config.matching.time_window_minutes
                            ):
                                results.append(MatchResult(
                                    cash_register_tx=cash_tx,
                                    payment_gateway_tx=payment_tx,
                                    status=MatchStatus.MATCHED,
                                    match_confidence=1.0
                                ))
                                cash_matched.add(cash_tx.transaction_id)
                                payment_matched.add(payment_tx.transaction_id)

        cash_unmatched = [tx for tx in cash_txs if tx.transaction_id not in cash_matched]
        payment_unmatched = [tx for tx in payment_txs if tx.transaction_id not in payment_matched]

        for cash_tx in cash_unmatched:
            best_match = None
            best_confidence = 0.0
            for payment_tx in payment_unmatched:
                if payment_tx.transaction_id in payment_matched:
                    continue
                if not self._is_amount_match(cash_tx.amount, payment_tx.amount):
                    continue
                if (self.config.matching.store_id_required and
                    cash_tx.store_id != payment_tx.store_id):
                    continue
                if self._is_time_match(
                    cash_tx.transaction_time,
                    payment_tx.transaction_time,
                    self.config.matching.time_window_minutes
                ):
                    confidence = 0.9
                    if cash_tx.store_id == payment_tx.store_id:
                        confidence += 0.05
                    if cash_tx.payment_method and payment_tx.payment_method:
                        if cash_tx.payment_method == payment_tx.payment_method:
                            confidence += 0.05
                    if confidence > best_confidence:
                        best_confidence = confidence
                        best_match = payment_tx
            if best_match:
                results.append(MatchResult(
                    cash_register_tx=cash_tx,
                    payment_gateway_tx=best_match,
                    status=MatchStatus.MATCHED,
                    match_confidence=best_confidence
                ))
                cash_matched.add(cash_tx.transaction_id)
                payment_matched.add(best_match.transaction_id)

        cash_unmatched_final = [tx for tx in cash_txs if tx.transaction_id not in cash_matched]
        payment_unmatched_final = [tx for tx in payment_txs if tx.transaction_id not in payment_matched]

        for cash_tx in cash_unmatched_final:
            results.append(MatchResult(
                cash_register_tx=cash_tx,
                payment_gateway_tx=None,
                status=MatchStatus.UNMATCHED,
                discrepancy_reason=DiscrepancyReason.MISSING_IN_PAYMENT_GATEWAY
            ))

        for payment_tx in payment_unmatched_final:
            results.append(MatchResult(
                cash_register_tx=None,
                payment_gateway_tx=payment_tx,
                status=MatchStatus.UNMATCHED,
                discrepancy_reason=DiscrepancyReason.MISSING_IN_CASH_REGISTER
            ))

        return results

    def _match_refunds(
        self,
        cash_refunds: List[Transaction],
        payment_refunds: List[Transaction],
        all_cash_payments: List[Transaction],
        all_payment_payments: List[Transaction]
    ) -> List[MatchResult]:
        results: List[MatchResult] = []
        cash_matched: Set[str] = set()
        payment_matched: Set[str] = set()

        payments_by_id: Dict[str, Transaction] = {tx.transaction_id: tx for tx in all_cash_payments}
        payments_by_id.update({tx.transaction_id: tx for tx in all_payment_payments})

        for cash_refund in cash_refunds:
            matched = False
            for payment_refund in payment_refunds:
                if payment_refund.transaction_id in payment_matched:
                    continue
                if not self._is_amount_match(cash_refund.amount, payment_refund.amount):
                    continue
                if cash_refund.refund_reference and payment_refund.refund_reference:
                    if cash_refund.refund_reference == payment_refund.refund_reference:
                        results.append(MatchResult(
                            cash_register_tx=cash_refund,
                            payment_gateway_tx=payment_refund,
                            status=MatchStatus.MATCHED,
                            match_confidence=1.0,
                            notes=f"退款匹配：原交易号 {cash_refund.refund_reference}"
                        ))
                        cash_matched.add(cash_refund.transaction_id)
                        payment_matched.add(payment_refund.transaction_id)
                        matched = True
                        break
                if self._is_time_match(
                    cash_refund.transaction_time,
                    payment_refund.transaction_time,
                    self.config.matching.refund_time_window_minutes
                ):
                    results.append(MatchResult(
                        cash_register_tx=cash_refund,
                        payment_gateway_tx=payment_refund,
                        status=MatchStatus.MATCHED,
                        match_confidence=0.7,
                        notes="退款时间窗口匹配"
                    ))
                    cash_matched.add(cash_refund.transaction_id)
                    payment_matched.add(payment_refund.transaction_id)
                    matched = True
                    break

        cash_unmatched = [tx for tx in cash_refunds if tx.transaction_id not in cash_matched]
        payment_unmatched = [tx for tx in payment_refunds if tx.transaction_id not in payment_matched]

        for cash_refund in cash_unmatched:
            results.append(MatchResult(
                cash_register_tx=cash_refund,
                payment_gateway_tx=None,
                status=MatchStatus.UNMATCHED,
                discrepancy_reason=DiscrepancyReason.REFUND_NOT_FOUND
            ))

        for payment_refund in payment_unmatched:
            results.append(MatchResult(
                cash_register_tx=None,
                payment_gateway_tx=payment_refund,
                status=MatchStatus.UNMATCHED,
                discrepancy_reason=DiscrepancyReason.REFUND_NOT_FOUND
            ))

        return results

    def match(
        self,
        cash_register_txs: List[Transaction],
        payment_gateway_txs: List[Transaction]
    ) -> Tuple[List[MatchResult], List[Transaction]]:
        cash_unique, cash_duplicates = self._find_duplicates(cash_register_txs)
        payment_unique, payment_duplicates = self._find_duplicates(payment_gateway_txs)

        all_duplicates = cash_duplicates + payment_duplicates

        cash_payments = [tx for tx in cash_unique if tx.transaction_type == TransactionType.PAYMENT]
        cash_refunds = [tx for tx in cash_unique if tx.transaction_type == TransactionType.REFUND]
        payment_payments = [tx for tx in payment_unique if tx.transaction_type == TransactionType.PAYMENT]
        payment_refunds = [tx for tx in payment_unique if tx.transaction_type == TransactionType.REFUND]

        payment_results = self._match_payments(cash_payments, payment_payments)
        refund_results = self._match_refunds(cash_refunds, payment_refunds, cash_payments, payment_payments)

        duplicate_results = []
        for dup in all_duplicates:
            source = "cash_register" if dup in cash_duplicates else "payment_gateway"
            duplicate_results.append(MatchResult(
                cash_register_tx=dup if source == "cash_register" else None,
                payment_gateway_tx=dup if source == "payment_gateway" else None,
                status=MatchStatus.DUPLICATE,
                discrepancy_reason=DiscrepancyReason.DUPLICATE_TRANSACTION,
                notes=f"重复流水，来源：{source}"
            ))

        all_results = payment_results + refund_results + duplicate_results
        all_results.sort(key=lambda r: (
            r.cash_register_tx.transaction_time.isoformat() if r.cash_register_tx
            else r.payment_gateway_tx.transaction_time.isoformat() if r.payment_gateway_tx
            else ""
        ))

        return all_results, all_duplicates

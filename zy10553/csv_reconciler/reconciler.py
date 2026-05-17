from dataclasses import dataclass
from typing import List, Dict, Set, Tuple
from decimal import Decimal
from collections import defaultdict

from .core import Transaction, BadRow


@dataclass
class Difference:
    transaction_id: str
    field_name: str
    source1_value: str
    source2_value: str
    difference: Decimal


@dataclass
class ReconciliationResult:
    total_transactions: int
    matched_transactions: int
    unmatched_source1: List[str]
    unmatched_source2: List[str]
    differences: List[Difference]
    bad_rows: List[BadRow]
    source1_file: str
    source2_file: str
    
    @property
    def has_differences(self) -> bool:
        return len(self.differences) > 0
    
    @property
    def has_unmatched(self) -> bool:
        return len(self.unmatched_source1) > 0 or len(self.unmatched_source2) > 0
    
    @property
    def has_bad_rows(self) -> bool:
        return len(self.bad_rows) > 0


class Reconciler:
    def __init__(self, tolerance: Decimal = Decimal('0.01')):
        self.tolerance = tolerance
    
    def reconcile(
        self,
        source1: List[Transaction],
        source2: List[Transaction],
        source1_name: str,
        source2_name: str
    ) -> ReconciliationResult:
        source1_map = {t.transaction_id: t for t in source1}
        source2_map = {t.transaction_id: t for t in source2}
        
        source1_ids = set(source1_map.keys())
        source2_ids = set(source2_map.keys())
        
        matched_ids = source1_ids & source2_ids
        unmatched_source1 = sorted(list(source1_ids - source2_ids))
        unmatched_source2 = sorted(list(source2_ids - source1_ids))
        
        differences = []
        
        for tx_id in sorted(matched_ids):
            t1 = source1_map[tx_id]
            t2 = source2_map[tx_id]
            
            diff_amount = t1.amount - t2.amount
            if abs(diff_amount) > self.tolerance:
                differences.append(Difference(
                    transaction_id=tx_id,
                    field_name='amount',
                    source1_value=str(t1.amount),
                    source2_value=str(t2.amount),
                    difference=diff_amount
                ))
            
            diff_tax = t1.tax - t2.tax
            if abs(diff_tax) > self.tolerance:
                differences.append(Difference(
                    transaction_id=tx_id,
                    field_name='tax',
                    source1_value=str(t1.tax),
                    source2_value=str(t2.tax),
                    difference=diff_tax
                ))
            
            diff_fee = t1.fee - t2.fee
            if abs(diff_fee) > self.tolerance:
                differences.append(Difference(
                    transaction_id=tx_id,
                    field_name='fee',
                    source1_value=str(t1.fee),
                    source2_value=str(t2.fee),
                    difference=diff_fee
                ))
            
            if t1.refund_status != t2.refund_status:
                differences.append(Difference(
                    transaction_id=tx_id,
                    field_name='refund_status',
                    source1_value=t1.refund_status,
                    source2_value=t2.refund_status,
                    difference=Decimal('0')
                ))
        
        return ReconciliationResult(
            total_transactions=len(source1_ids | source2_ids),
            matched_transactions=len(matched_ids),
            unmatched_source1=unmatched_source1,
            unmatched_source2=unmatched_source2,
            differences=differences,
            bad_rows=[],
            source1_file=source1_name,
            source2_file=source2_name
        )
    
    def group_differences_by_field(self, result: ReconciliationResult) -> Dict[str, List[Difference]]:
        groups = defaultdict(list)
        for diff in result.differences:
            groups[diff.field_name].append(diff)
        return dict(groups)
    
    def group_differences_by_transaction(self, result: ReconciliationResult) -> Dict[str, List[Difference]]:
        groups = defaultdict(list)
        for diff in result.differences:
            groups[diff.transaction_id].append(diff)
        return dict(groups)

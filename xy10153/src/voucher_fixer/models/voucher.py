from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional


class VoucherType(str, Enum):
    RECEIPT = "收"
    PAYMENT = "付"
    TRANSFER = "转"
    GENERAL = "记"


class VoucherStatus(str, Enum):
    NORMAL = "normal"
    REVERSED = "reversed"
    REVERSAL = "reversal"


@dataclass
class VoucherEntry:
    account_code: str
    account_name: str
    debit: float = 0.0
    credit: float = 0.0
    description: Optional[str] = None

    def is_debit_balance(self) -> bool:
        return abs(self.debit) > abs(self.credit)

    def is_credit_balance(self) -> bool:
        return abs(self.credit) > abs(self.debit)


@dataclass
class Voucher:
    id: str
    source_file: str
    line_number: int
    voucher_date: datetime
    voucher_type: VoucherType
    voucher_number: str
    number_sequence: int
    description: Optional[str] = None
    entries: List[VoucherEntry] = field(default_factory=list)
    original_data: Dict[str, Any] = field(default_factory=dict)

    related_reversal_id: Optional[str] = None
    related_original_id: Optional[str] = None
    status: VoucherStatus = VoucherStatus.NORMAL

    def total_debit(self) -> float:
        return sum(e.debit for e in self.entries)

    def total_credit(self) -> float:
        return sum(e.credit for e in self.entries)

    def is_balanced(self, tolerance: float = 0.01) -> bool:
        return abs(self.total_debit() - self.total_credit()) <= tolerance

    def is_possible_reversal_of(self, other: Voucher) -> bool:
        if self.voucher_type != other.voucher_type:
            return False
        if len(self.entries) != len(other.entries):
            return False
        for s, o in zip(self.entries, other.entries):
            if s.account_code != o.account_code:
                return False
            if abs(abs(s.debit) - abs(o.debit)) > 0.01:
                return False
            if abs(abs(s.credit) - abs(o.credit)) > 0.01:
                return False
        if not self._is_reversed_signs(other):
            return False
        return True

    def _is_reversed_signs(self, other: Voucher) -> bool:
        for s, o in zip(self.entries, other.entries):
            if s.debit != 0 and o.debit != 0:
                if s.debit * o.debit > 0:
                    return False
            if s.credit != 0 and o.credit != 0:
                if s.credit * o.credit > 0:
                    return False
        return True


@dataclass
class VoucherBatch:
    vouchers: List[Voucher] = field(default_factory=list)
    source_files: List[str] = field(default_factory=list)

    def add(self, voucher: Voucher):
        self.vouchers.append(voucher)

    def add_all(self, vouchers: List[Voucher]):
        self.vouchers.extend(vouchers)

    def group_by_type(self) -> Dict[VoucherType, List[Voucher]]:
        groups: Dict[VoucherType, List[Voucher]] = {}
        for v in self.vouchers:
            groups.setdefault(v.voucher_type, []).append(v)
        for vt in groups:
            groups[vt].sort(key=lambda x: x.number_sequence)
        return groups

    def get_by_id(self, vid: str) -> Optional[Voucher]:
        for v in self.vouchers:
            if v.id == vid:
                return v
        return None

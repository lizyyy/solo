from dataclasses import dataclass, field
from enum import Enum
from datetime import date
from decimal import Decimal
from typing import Optional


class Source(Enum):
    TAIL_ADJUST = "尾差调整条"
    CUSTODY_CONFIRM = "托管确认页"
    MANUAL_FIX = "人工修正"
    RERUN = "重跑"


class MatchStatus(Enum):
    MATCHED = "匹配通过"
    SPLIT_PENDING = "拆行待复核"
    OLD_CALIBER = "旧口径补录"
    MISMATCH = "差异待查"


class ReviewStatus(Enum):
    PENDING = "待复核"
    PASSED = "复核通过"
    REJECTED = "复核退回"


@dataclass
class ExposureRecord:
    business_no: str
    bond_code: str
    bond_name: str
    face_value: Decimal
    source: Source
    trade_date: date
    fee_line: Optional[Decimal] = None
    principal_line: Optional[Decimal] = None
    old_caliber_flag: bool = False
    match_status: Optional[MatchStatus] = None
    review_status: Optional[ReviewStatus] = None
    remark: str = ""


@dataclass
class DiffItem:
    business_no: str
    diff_type: str
    detail: str
    source_a: str
    source_b: str
    amount_diff: Optional[Decimal] = None


@dataclass
class HistoryEntry:
    business_no: str
    action: str
    operator: str
    timestamp: str
    before_value: str = ""
    after_value: str = ""

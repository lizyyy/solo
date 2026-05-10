"""数据模型和类型定义"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import List, Optional, Dict, Any


class RecordStatus(Enum):
    PENDING = "待复核"
    REVIEWED = "已复核"
    REJECTED = "已拒绝"
    DUPLICATE = "重复记录"
    INVALID = "无效记录"


class SettlementStatus(Enum):
    DRAFT = "草稿"
    TRIAL = "试算中"
    CONFIRMED = "已确认"
    PAID = "已发放"


@dataclass
class Worker:
    worker_id: str
    name: str
    team_id: str
    base_rate: float = 2.5


@dataclass
class Team:
    team_id: str
    name: str
    leader: str


@dataclass
class PickRecord:
    record_id: str
    worker_id: str
    worker_name: str
    team_id: str
    team_name: str
    pick_date: str
    baskets: int
    total_weight: float
    bad_weight: float
    reviewed: bool
    reviewer: Optional[str] = None
    review_time: Optional[str] = None
    advance_payment: float = 0.0
    status: RecordStatus = RecordStatus.PENDING
    reject_reason: str = ""
    imported_at: str = ""
    settlement_batch: Optional[str] = None

    @property
    def net_weight(self) -> float:
        return max(0.0, self.total_weight - self.bad_weight)

    @property
    def is_valid(self) -> bool:
        if self.bad_weight > self.total_weight:
            return False
        if self.total_weight < 0 or self.bad_weight < 0:
            return False
        return True


@dataclass
class Deduction:
    record_id: str
    worker_id: str
    worker_name: str
    category: str
    description: str
    amount: float
    before_value: float
    after_value: float


@dataclass
class WorkerSettlement:
    worker_id: str
    worker_name: str
    team_id: str
    team_name: str
    total_baskets: int = 0
    total_gross_weight: float = 0.0
    total_bad_weight: float = 0.0
    total_net_weight: float = 0.0
    gross_amount: float = 0.0
    total_deductions: float = 0.0
    advance_payment: float = 0.0
    net_amount: float = 0.0
    deductions: List[Deduction] = field(default_factory=list)
    valid_records: int = 0
    invalid_records: int = 0


@dataclass
class TeamSettlement:
    team_id: str
    team_name: str
    workers: List[WorkerSettlement] = field(default_factory=list)
    total_baskets: int = 0
    total_gross_weight: float = 0.0
    total_bad_weight: float = 0.0
    total_net_weight: float = 0.0
    gross_amount: float = 0.0
    total_deductions: float = 0.0
    total_advance: float = 0.0
    net_amount: float = 0.0


@dataclass
class SettlementSummary:
    batch_id: str
    created_at: str
    status: SettlementStatus = SettlementStatus.DRAFT
    total_records: int = 0
    valid_records: int = 0
    invalid_records: int = 0
    duplicate_records: int = 0
    unreviewed_records: int = 0
    total_baskets: int = 0
    total_gross_weight: float = 0.0
    total_bad_weight: float = 0.0
    total_net_weight: float = 0.0
    gross_amount: float = 0.0
    total_deductions: float = 0.0
    total_advance: float = 0.0
    net_amount: float = 0.0
    team_settlements: List[TeamSettlement] = field(default_factory=list)
    deductions: List[Deduction] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)

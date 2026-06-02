from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, Dict, List, Any
from enum import Enum
import hashlib
import json


class TailDifferenceStatus(Enum):
    PENDING_REVIEW = "待风控复核"
    REVIEWING = "复核中"
    NORMAL = "正常"
    NEED_MATERIAL = "待补充材料"
    RESOLVED = "已处理"


class ChangeType(Enum):
    STATUS_CHANGE = "状态变更"
    REMARK_CHANGE = "备注修改"
    BATCH_LINK = "关联清算批次"
    AMOUNT_ADJUST = "金额调整"


@dataclass
class CalculationParams:
    version: str
    tolerance_threshold: float
    rounding_method: str
    trade_date_cutoff: str
    notes: str


@dataclass
class ChangeHistory:
    id: str
    timestamp: datetime
    field_name: str
    old_value: Optional[str]
    new_value: Optional[str]
    operator: str
    change_type: ChangeType
    reason: Optional[str] = None


@dataclass
class ClientEmail:
    id: str
    batch_id: str
    source_file: str
    import_time: datetime
    content_hash: str
    raw_data: Dict[str, Any]


@dataclass
class SettlementBatch:
    batch_number: str
    trade_date: str
    settlement_date: str
    total_amount: float
    status: str


@dataclass
class TailDifferenceRecord:
    id: str
    trade_date: str
    fund_code: str
    fund_name: str
    application_amount: float
    redemption_amount: float
    settlement_amount: float
    tail_difference: float
    status: TailDifferenceStatus
    remark: Optional[str] = None
    client_email_id: Optional[str] = None
    settlement_batch_number: Optional[str] = None
    responsible_person: Optional[str] = None
    next_action: Optional[str] = None
    missing_materials: List[str] = field(default_factory=list)
    change_history: List[ChangeHistory] = field(default_factory=list)
    calculation_params: Optional[CalculationParams] = None
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)

    def generate_content_hash(self) -> str:
        content = json.dumps({
            'trade_date': self.trade_date,
            'fund_code': self.fund_code,
            'application_amount': self.application_amount,
            'redemption_amount': self.redemption_amount,
            'settlement_amount': self.settlement_amount,
        }, sort_keys=True)
        return hashlib.md5(content.encode()).hexdigest()

    def add_change_history(self, change: ChangeHistory):
        self.change_history.append(change)
        self.updated_at = change.timestamp

    def needs_manual_review(self) -> bool:
        return (self.tail_difference == 0 and 
                self.remark and 
                "已冲正" in self.remark and
                self.status == TailDifferenceStatus.PENDING_REVIEW)

    def get_review_summary(self) -> Dict[str, Any]:
        return {
            'record_id': self.id,
            'fund': f"{self.fund_code} {self.fund_name}",
            'tail_difference': self.tail_difference,
            'status': self.status.value,
            'why_kept': self._get_why_kept(),
            'missing_materials': self.missing_materials,
            'next_action': self.next_action,
            'responsible': self.responsible_person,
            'can_trace_to_email': self.client_email_id is not None,
            'can_trace_to_batch': self.settlement_batch_number is not None,
        }

    def _get_why_kept(self) -> str:
        if self.needs_manual_review():
            return "金额为0但备注标注已冲正，系统保留供风控同事人工复核确认"
        elif abs(self.tail_difference) > 0:
            return f"申赎尾差为{self.tail_difference:.2f}元，需核实差异原因"
        elif self.status == TailDifferenceStatus.NEED_MATERIAL:
            return "缺少必要支撑材料，待补充后再判断"
        else:
            return "待进一步分析"

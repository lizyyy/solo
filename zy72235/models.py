from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Dict, Optional, Any
from enum import Enum
import uuid


class BusinessStatus(Enum):
    PENDING_REVIEW = "待结算主管复核"
    NORMAL = "正常"
    NEEDS_MATERIAL = "待补充材料"
    DISPUTED = "有争议"


class MaterialType(Enum):
    HOLIDAY_EXTENSION = "节假日顺延说明"
    TAIL_ADJUSTMENT = "尾差调整条"


class ReviewAction(Enum):
    APPROVE = "通过"
    REJECT = "驳回"
    NEEDS_INFO = "需补充信息"
    SPLIT_FEE_PRINCIPAL = "拆分手续费本金"


class NextStepRole(Enum):
    SETTLEMENT_SUPERVISOR = "结算主管"
    RESEARCH_ASSISTANT = "投研助理小周"
    BUSINESS_MANAGER = "业务经理"


@dataclass
class HolidayExtension:
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    business_no: str = ""
    original_due_date: Optional[datetime] = None
    extended_due_date: Optional[datetime] = None
    reason: str = ""
    remark: str = ""
    import_batch_no: str = ""
    imported_at: datetime = field(default_factory=datetime.now)
    imported_by: str = "投研助理小周"
    version: int = 1

    def get_key(self) -> str:
        return f"{self.business_no}_{self.original_due_date}_{self.extended_due_date}"


@dataclass
class TailAdjustment:
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    business_no: str = ""
    adjustment_type: str = ""
    amount: float = 0.0
    reason: str = ""
    remark: str = ""
    import_batch_no: str = ""
    imported_at: datetime = field(default_factory=datetime.now)
    imported_by: str = "投研助理小周"
    version: int = 1


@dataclass
class BusinessDetail:
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    business_no: str = ""
    detail_type: str = ""
    amount: float = 0.0
    predicted_value: Optional[float] = None
    related_holiday_id: Optional[str] = None
    related_tail_id: Optional[str] = None
    status: BusinessStatus = BusinessStatus.PENDING_REVIEW
    created_at: datetime = field(default_factory=datetime.now)


@dataclass
class ChangeRecord:
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    entity_type: str = ""
    entity_id: str = ""
    field_name: str = ""
    old_value: Any = None
    new_value: Any = None
    changed_by: str = ""
    changed_at: datetime = field(default_factory=datetime.now)
    change_reason: str = ""

    def to_dict(self) -> Dict:
        return {
            "修改人": self.changed_by,
            "修改时间": self.changed_at.strftime("%Y-%m-%d %H:%M:%S"),
            "修改字段": self.field_name,
            "修改前": str(self.old_value),
            "修改后": str(self.new_value),
            "修改原因": self.change_reason
        }


@dataclass
class ReviewRecord:
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    business_no: str = ""
    reviewer: str = ""
    review_action: ReviewAction = ReviewAction.APPROVE
    review_comment: str = ""
    reviewed_at: datetime = field(default_factory=datetime.now)
    affected_details: List[str] = field(default_factory=list)


@dataclass
class DifferenceItem:
    business_no: str = ""
    description: str = ""
    reason_kept: str = ""
    missing_materials: List[str] = field(default_factory=list)
    next_step_role: NextStepRole = NextStepRole.RESEARCH_ASSISTANT
    next_step_action: str = ""
    related_holiday_id: Optional[str] = None
    related_tail_id: Optional[str] = None


@dataclass
class LoanRenewalScore:
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    business_no: str = ""
    score: float = 0.0
    score_level: str = ""
    formula: str = ""
    sample_count: int = 0
    holiday_extensions: List[HolidayExtension] = field(default_factory=list)
    tail_adjustments: List[TailAdjustment] = field(default_factory=list)
    business_details: List[BusinessDetail] = field(default_factory=list)
    change_history: List[ChangeRecord] = field(default_factory=list)
    review_records: List[ReviewRecord] = field(default_factory=list)
    differences: List[DifferenceItem] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)

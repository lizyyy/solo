from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any


class Currency(str, Enum):
    CNY = "CNY"
    HKD = "HKD"
    MIXED = "MIXED"
    UNKNOWN = "UNKNOWN"


class RecordStatus(str, Enum):
    INITIAL = "待处理"
    EMAIL_IMPORTED = "邮件已导入"
    CUSTODIAN_PENDING = "待托管对接人复核"
    SETTLEMENT_CHECKED = "清算批次已补看"
    CONFLICT = "存在冲突待确认"
    CONFIRMED = "已确认"
    REJECTED = "已驳回"
    AUDIT_UPDATED = "审计已更新"
    COMPLETED = "已完成"


class ProcessingResult(str, Enum):
    SMOOTH = "顺利处理"
    CURRENCY_MIXED = "港币人民币同列待复核"
    OLD_CALIBER = "旧口径补录"
    CONFLICT_FOUND = "发现冲突待决策"


class ConflictType(str, Enum):
    CURRENCY_CONFLICT = "币种冲突"
    RATE_CONFLICT = "费率冲突"
    CALIBER_CONFLICT = "口径冲突"


@dataclass
class EmailSupplement:
    email_id: str
    sender: str
    sent_at: datetime
    product_code: str
    currency_raw: str
    rate: float
    effective_date: str
    version_remark: str
    raw_content: str


@dataclass
class SettlementBatch:
    batch_no: str
    import_time: datetime
    product_code: str
    currency: Currency
    rate: float
    effective_date: str
    caliber_version: str
    is_old_caliber: bool = False


@dataclass
class ProfessionalCalc:
    calc_model_version: str
    parameter_version: str
    input_params: Dict[str, Any]
    calc_result: float
    decision_reason: str
    calc_time: datetime


@dataclass
class ConflictEvidence:
    conflict_type: ConflictType
    field_name: str
    email_value: Any
    settlement_value: Any
    description: str
    email_source: str
    settlement_source: str


@dataclass
class AuditDetail:
    audit_id: str
    record_id: str
    step_name: str
    operator: str
    operation_time: datetime
    before_status: RecordStatus
    after_status: RecordStatus
    change_content: str
    currency_verified: Optional[bool] = None
    professional_calc: Optional[ProfessionalCalc] = None
    conflict_evidence: Optional[ConflictEvidence] = None
    decision_choice: Optional[str] = None


@dataclass
class HistoryRecord:
    history_id: str
    record_id: str
    version_no: int
    field_name: str
    old_value: Any
    new_value: Any
    change_reason: str
    operator: str
    operate_time: datetime
    source_type: str


@dataclass
class FeeRateRecord:
    record_id: str
    product_code: str
    product_name: str
    status: RecordStatus
    email_supplement: Optional[EmailSupplement] = None
    settlement_batch: Optional[SettlementBatch] = None
    final_currency: Optional[Currency] = None
    final_rate: Optional[float] = None
    final_effective_date: Optional[str] = None
    processing_result: Optional[ProcessingResult] = None
    need_custodian_review: bool = False
    has_conflict: bool = False
    conflict_evidences: List[ConflictEvidence] = field(default_factory=list)
    audit_details: List[AuditDetail] = field(default_factory=list)
    history_records: List[HistoryRecord] = field(default_factory=list)
    professional_calcs: List[ProfessionalCalc] = field(default_factory=list)
    custodian_review_result: Optional[bool] = None
    custodian_reviewer: Optional[str] = None
    custodian_review_time: Optional[datetime] = None
    final_decision_maker: Optional[str] = None
    final_decision_time: Optional[datetime] = None
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)

from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, List, Dict, Any
from enum import Enum
import uuid


class RecordStatus(str, Enum):
    PENDING = "待复核"
    CONFLICT = "机构简称不一致"
    NORMAL = "正常"
    REVIEWED = "已复核"


class NextHandler(str, Enum):
    FINANCIAL_REVIEWER = "财务复核人"
    FUND_ACCOUNTANT = "基金会计林姐"
    ACCOUNT_MANAGER = "客户经理"


@dataclass
class AccountManagerEmail:
    email_id: str
    batch_no: str
    institution_name: str
    institution_short_name: str
    loan_amount: float
    interest_rate: float
    start_date: str
    end_date: str
    import_time: datetime
    source_file: str
    raw_content: str

    def get_unique_key(self) -> str:
        return f"{self.batch_no}_{self.institution_name}_{self.start_date}_{self.end_date}"


@dataclass
class SettlementBatch:
    batch_id: str
    batch_no: str
    institution_name: str
    institution_short_name: str
    settlement_amount: float
    settlement_date: str
    import_time: datetime
    source_file: str


@dataclass
class CalculationParameter:
    version: str
    parameter_name: str
    value: Any
    reason: str
    effective_date: str
    created_by: str


@dataclass
class CalculationResult:
    principal: float
    days: int
    rate: float
    interest: float
    formula: str
    parameters: List[CalculationParameter]


@dataclass
class SupplementaryRecord:
    record_id: str
    reason_kept: str
    missing_materials: List[str]
    next_handler: NextHandler
    notes: str
    created_at: datetime
    created_by: str


@dataclass
class AuditHistory:
    history_id: str
    record_id: str
    field_name: str
    old_value: Any
    new_value: Any
    changed_by: str
    changed_at: datetime
    change_reason: str


@dataclass
class LoanInterestRecord:
    record_id: str
    source_email_ids: List[str]
    source_batch_ids: List[str]
    institution_name: str
    email_short_name: str
    batch_short_name: str
    loan_amount: float
    interest_rate: float
    start_date: str
    end_date: str
    calculation: CalculationResult
    status: RecordStatus
    supplementary: Optional[SupplementaryRecord] = None
    audit_history: List[AuditHistory] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    version: int = 1
    remark: str = ""

    def has_short_name_conflict(self) -> bool:
        return self.email_short_name != self.batch_short_name

    def add_audit_record(self, field_name: str, old_value: Any, new_value: Any,
                         changed_by: str, change_reason: str):
        if old_value == new_value:
            return
        audit = AuditHistory(
            history_id=str(uuid.uuid4()),
            record_id=self.record_id,
            field_name=field_name,
            old_value=old_value,
            new_value=new_value,
            changed_by=changed_by,
            changed_at=datetime.now(),
            change_reason=change_reason
        )
        self.audit_history.append(audit)
        self.updated_at = datetime.now()
        self.version += 1

import enum
import uuid
from dataclasses import dataclass, field
from datetime import datetime, date
from typing import Optional


class RecordStatus(enum.Enum):
    CONFIRMED = "confirmed"
    PENDING_MATERIAL = "pending_material"
    MANUAL_OVERRIDE = "manual_override"
    CONFLICT = "conflict"


class DuplicateAction(enum.Enum):
    SKIP = "skip"
    UPDATE = "update"
    CONFLICT = "conflict"


@dataclass
class SourceTrace:
    file_name: str
    sheet_name: Optional[str] = None
    row_number: Optional[int] = None
    import_batch: Optional[str] = None
    import_time: Optional[str] = None
    original_raw: Optional[dict] = None

    def to_dict(self) -> dict:
        return {
            "file_name": self.file_name,
            "sheet_name": self.sheet_name,
            "row_number": self.row_number,
            "import_batch": self.import_batch,
            "import_time": self.import_time,
            "original_raw": self.original_raw,
        }


@dataclass
class AuditEntry:
    timestamp: str
    action: str
    detail: str
    before_value: Optional[str] = None
    after_value: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "timestamp": self.timestamp,
            "action": self.action,
            "detail": self.detail,
            "before_value": self.before_value,
            "after_value": self.after_value,
        }


@dataclass
class LedgerRecord:
    record_id: str = field(default_factory=lambda: uuid.uuid4().hex[:12])
    trade_date: Optional[date] = None
    route: str = ""
    hedge_type: str = ""
    direction: str = ""
    notional_amount: Optional[float] = None
    currency: str = "USD"
    counterparty: str = ""
    operator: str = ""
    operator_raw: str = ""
    contract_period: str = ""
    settlement_date: Optional[date] = None
    status: RecordStatus = RecordStatus.PENDING_MATERIAL
    source: Optional[SourceTrace] = None
    audit_trail: list = field(default_factory=list)
    duplicate_action: Optional[DuplicateAction] = None
    remark: str = ""
    caliber: str = "current"

    def add_audit(self, action: str, detail: str, before: str = None, after: str = None):
        entry = AuditEntry(
            timestamp=datetime.now().isoformat(),
            action=action,
            detail=detail,
            before_value=before,
            after_value=after,
        )
        self.audit_trail.append(entry)

    def to_dict(self) -> dict:
        return {
            "record_id": self.record_id,
            "trade_date": self.trade_date.isoformat() if self.trade_date else "",
            "route": self.route,
            "hedge_type": self.hedge_type,
            "direction": self.direction,
            "notional_amount": self.notional_amount,
            "currency": self.currency,
            "counterparty": self.counterparty,
            "operator": self.operator,
            "operator_raw": self.operator_raw,
            "contract_period": self.contract_period,
            "settlement_date": self.settlement_date.isoformat() if self.settlement_date else "",
            "status": self.status.value,
            "source": self.source.to_dict() if self.source else {},
            "audit_trail": [e.to_dict() if hasattr(e, 'to_dict') else e for e in self.audit_trail],
            "duplicate_action": self.duplicate_action.value if self.duplicate_action else "",
            "remark": self.remark,
            "caliber": self.caliber,
        }

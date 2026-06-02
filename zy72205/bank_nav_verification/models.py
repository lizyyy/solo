from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any


class RemarkStatus(str, Enum):
    IMPORTED = "imported"
    TAIL_REVIEWED = "tail_reviewed"
    RECONCILIATION_UPDATED = "reconciliation_updated"
    PENDING_REVIEW = "pending_review"
    FLAGGED_FOR_MANAGER = "flagged_for_manager"


class ChangeType(str, Enum):
    IMPORT = "import"
    MANUAL_EDIT = "manual_edit"
    STATUS_CHANGE = "status_change"
    ROLLBACK = "rollback"
    TAIL_REVIEW = "tail_review"
    RECONCILIATION_UPDATE = "reconciliation_update"


class SettlementType(str, Enum):
    T_PLUS_0 = "T+0"
    T_PLUS_1 = "T+1"
    T_PLUS_2 = "T+2"
    T_PLUS_3 = "T+3"


@dataclass
class FieldChange:
    field_name: str
    old_value: Any
    new_value: Any

    def to_dict(self) -> dict:
        return {
            "field_name": self.field_name,
            "old_value": repr(self.old_value),
            "new_value": repr(self.new_value),
        }


@dataclass
class ChangeRecord:
    id: str = field(default_factory=lambda: uuid.uuid4().hex[:12])
    change_type: ChangeType = ChangeType.IMPORT
    operator: str = ""
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())
    field_changes: list[FieldChange] = field(default_factory=list)
    reason: str = ""
    settlement_override: bool = False

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "change_type": self.change_type.value,
            "operator": self.operator,
            "timestamp": self.timestamp,
            "field_changes": [fc.to_dict() for fc in self.field_changes],
            "reason": self.reason,
            "settlement_override": self.settlement_override,
        }


@dataclass
class TaxRateRemark:
    id: str = field(default_factory=lambda: uuid.uuid4().hex[:16])
    batch_id: str = ""
    original_line_number: int = 0
    product_code: str = ""
    product_name: str = ""
    tax_rate: float = 0.0
    settlement_type: SettlementType = SettlementType.T_PLUS_1
    original_settlement_type: SettlementType = SettlementType.T_PLUS_1
    remark_text: str = ""
    counter_flow_tail: str = ""
    reconciliation_note: str = ""
    status: RemarkStatus = RemarkStatus.IMPORTED
    flagged_for_manager: bool = False
    flag_reason: str = ""
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now().isoformat())
    history: list[ChangeRecord] = field(default_factory=list)
    _snapshot: dict | None = field(default=None, repr=False)

    def __post_init__(self):
        self._take_snapshot()

    def _take_snapshot(self):
        self._snapshot = {
            "original_line_number": self.original_line_number,
            "product_code": self.product_code,
            "product_name": self.product_name,
            "tax_rate": self.tax_rate,
            "settlement_type": self.settlement_type,
            "remark_text": self.remark_text,
            "counter_flow_tail": self.counter_flow_tail,
            "reconciliation_note": self.reconciliation_note,
            "status": self.status,
        }

    def _diff_against_snapshot(self) -> list[FieldChange]:
        if self._snapshot is None:
            return []
        changes = []
        for key, old_val in self._snapshot.items():
            new_val = getattr(self, key, None)
            if old_val != new_val:
                changes.append(FieldChange(field_name=key, old_value=old_val, new_value=new_val))
        return changes

    def record_change(
        self,
        change_type: ChangeType,
        operator: str = "",
        reason: str = "",
        settlement_override: bool = False,
    ) -> ChangeRecord | None:
        field_changes = self._diff_against_snapshot()
        if not field_changes and change_type != ChangeType.IMPORT:
            return None
        record = ChangeRecord(
            change_type=change_type,
            operator=operator,
            field_changes=field_changes,
            reason=reason,
            settlement_override=settlement_override,
        )
        self.history.append(record)
        self.updated_at = datetime.now().isoformat()
        self._take_snapshot()
        return record

    def get_change_history(self) -> list[dict]:
        return [r.to_dict() for r in self.history]

    def get_last_change(self) -> dict | None:
        if not self.history:
            return None
        return self.history[-1].to_dict()

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "batch_id": self.batch_id,
            "original_line_number": self.original_line_number,
            "product_code": self.product_code,
            "product_name": self.product_name,
            "tax_rate": self.tax_rate,
            "settlement_type": self.settlement_type.value,
            "original_settlement_type": self.original_settlement_type.value,
            "remark_text": self.remark_text,
            "counter_flow_tail": self.counter_flow_tail,
            "reconciliation_note": self.reconciliation_note,
            "status": self.status.value,
            "flagged_for_manager": self.flagged_for_manager,
            "flag_reason": self.flag_reason,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "history_count": len(self.history),
        }


@dataclass
class ImportBatch:
    id: str = field(default_factory=lambda: uuid.uuid4().hex[:12])
    source_file: str = ""
    import_timestamp: str = field(default_factory=lambda: datetime.now().isoformat())
    remark_count: int = 0
    content_hash: str = ""

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "source_file": self.source_file,
            "import_timestamp": self.import_timestamp,
            "remark_count": self.remark_count,
            "content_hash": self.content_hash,
        }

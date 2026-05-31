from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional


class RecordSource(Enum):
    BALANCE_TABLE = "balance_table"
    TEST_RECORD = "test_record"
    MANUAL_EDIT = "manual_edit"
    BATTLE_REPORT = "battle_report"
    SETTLEMENT = "settlement"


class RecordStatus(Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    SUCCESS = "success"
    FAILED = "failed"
    NEEDS_CLARIFICATION = "needs_clarification"


@dataclass
class ChangeLog:
    timestamp: datetime
    operator: str
    field_name: str
    old_value: Any
    new_value: Any
    reason: str


@dataclass
class DiscrepancyInfo:
    source_type: RecordSource
    battle_report_value: Any
    settlement_value: Any
    next_owner: str
    description: str


@dataclass
class MineRepairRecord:
    record_id: str
    material_id: str
    source: RecordSource
    status: RecordStatus
    created_at: datetime
    created_by: str
    pending_reason: str = ""
    change_history: List[ChangeLog] = field(default_factory=list)
    discrepancy: Optional[DiscrepancyInfo] = None
    unit_table_changes: Dict[str, List[ChangeLog]] = field(default_factory=dict)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def add_change(self, operator: str, field_name: str, old_value: Any, new_value: Any, reason: str):
        self.change_history.append(ChangeLog(
            timestamp=datetime.now(),
            operator=operator,
            field_name=field_name,
            old_value=old_value,
            new_value=new_value,
            reason=reason
        ))

    def add_unit_table_change(self, unit_id: str, operator: str, field_name: str, old_value: Any, new_value: Any, reason: str):
        if unit_id not in self.unit_table_changes:
            self.unit_table_changes[unit_id] = []
        self.unit_table_changes[unit_id].append(ChangeLog(
            timestamp=datetime.now(),
            operator=operator,
            field_name=field_name,
            old_value=old_value,
            new_value=new_value,
            reason=reason
        ))

    def set_discrepancy(self, source_type: RecordSource, battle_report_value: Any, 
                        settlement_value: Any, next_owner: str, description: str):
        self.discrepancy = DiscrepancyInfo(
            source_type=source_type,
            battle_report_value=battle_report_value,
            settlement_value=settlement_value,
            next_owner=next_owner,
            description=description
        )
        self.status = RecordStatus.NEEDS_CLARIFICATION

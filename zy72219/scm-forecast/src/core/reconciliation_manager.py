import uuid
from datetime import datetime, date
from pathlib import Path
import sys
from typing import List, Optional, Dict, Any, Tuple

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from src.models import (
    ForecastDataset,
    ForecastRecord,
    ReconciliationNote,
    ChangeHistory,
    WorkflowStepStatus,
)


class ReconciliationManager:
    def __init__(self):
        self.reconciliation_history: Dict[str, List[ReconciliationNote]] = {}

    def _generate_note_id(self) -> str:
        return f"note_{uuid.uuid4().hex[:8]}"

    def add_reconciliation_note(self, dataset: ForecastDataset,
                                record_id: str,
                                note_content: str,
                                note_type: str,
                                created_by: str,
                                is_reconciled: bool = False) -> ReconciliationNote:
        note = ReconciliationNote(
            note_id=self._generate_note_id(),
            batch_id=dataset.batch.batch_id,
            record_id=record_id,
            note_content=note_content,
            note_type=note_type,
            created_by=created_by,
            created_timestamp=datetime.now(),
            is_reconciled=is_reconciled,
            reconciled_by=created_by if is_reconciled else None,
            reconciled_timestamp=datetime.now() if is_reconciled else None,
        )

        dataset.reconciliation_notes.append(note)

        if record_id not in self.reconciliation_history:
            self.reconciliation_history[record_id] = []
        self.reconciliation_history[record_id].append(note)

        history = ChangeHistory(
            history_id=f"hist_{uuid.uuid4().hex[:8]}",
            record_id=record_id,
            batch_id=dataset.batch.batch_id,
            field_changed="reconciliation_note",
            old_value="(新增)",
            new_value=note_content[:100] + "..." if len(note_content) > 100 else note_content,
            changed_by=created_by,
            change_timestamp=datetime.now(),
            change_reason=f"添加对账说明，类型: {note_type}",
        )
        dataset.change_history.append(history)

        return note

    def update_reconciliation_note(self, dataset: ForecastDataset,
                                   note_id: str,
                                   new_content: str,
                                   updated_by: str,
                                   mark_reconciled: bool = False) -> Optional[ReconciliationNote]:
        note = next((n for n in dataset.reconciliation_notes if n.note_id == note_id), None)
        if not note:
            return None

        old_content = note.note_content
        note.note_content = new_content
        note.updated_by = updated_by
        note.updated_timestamp = datetime.now()

        if mark_reconciled:
            note.is_reconciled = True
            note.reconciled_by = updated_by
            note.reconciled_timestamp = datetime.now()

        history = ChangeHistory(
            history_id=f"hist_{uuid.uuid4().hex[:8]}",
            record_id=note.record_id,
            batch_id=note.batch_id,
            field_changed="reconciliation_note_update",
            old_value=old_content[:100] + "..." if len(old_content) > 100 else old_content,
            new_value=new_content[:100] + "..." if len(new_content) > 100 else new_content,
            changed_by=updated_by,
            change_timestamp=datetime.now(),
            change_reason=f"更新对账说明{'并标记已对账' if mark_reconciled else ''}",
        )
        dataset.change_history.append(history)

        return note

    def check_reconciliation_match(self, dataset: ForecastDataset,
                                   record: ForecastRecord) -> Tuple[bool, str, List[ReconciliationNote]]:
        notes = dataset.get_notes_for_record(record.record_id)

        if not notes:
            return False, "无对账说明", []

        reconciled_notes = [n for n in notes if n.is_reconciled]

        if not reconciled_notes:
            return False, "存在对账说明但未标记已对账", notes

        cycle_matches = any(
            record.current_settlement_cycle.value in n.note_content
            or record.expected_arrival_date.isoformat() in n.note_content
            for n in notes
        )

        if record.is_manually_modified:
            mod_matches = any(
                "T+2" in n.note_content or "手工修改" in n.note_content or "顺延" in n.note_content
                for n in notes
            )
            if not mod_matches:
                return False, "对账说明未提及手工修改或顺延情况", notes

        if not cycle_matches:
            return False, "对账说明与当前账期/到账日不匹配", notes

        return True, "对账说明与历史记录匹配", notes

    def update_reconciliation_for_batch(self, dataset: ForecastDataset,
                                        operator: str = "风控值班老秦") -> Dict:
        results = {
            "total_records": len(dataset.records),
            "records_with_notes": 0,
            "records_reconciled": 0,
            "records_mismatch": 0,
            "notes_added": 0,
            "notes_updated": 0,
        }

        for record in dataset.records:
            notes = dataset.get_notes_for_record(record.record_id)
            if notes:
                results["records_with_notes"] += 1

            is_match, reason, notes = self.check_reconciliation_match(dataset, record)

            if not is_match:
                results["records_mismatch"] += 1

                auto_note_content = self._generate_auto_reconciliation_note(record, reason)
                self.add_reconciliation_note(
                    dataset=dataset,
                    record_id=record.record_id,
                    note_content=auto_note_content,
                    note_type="system_generated",
                    created_by=operator,
                    is_reconciled=False,
                )
                results["notes_added"] += 1

            if any(n.is_reconciled for n in notes):
                results["records_reconciled"] += 1

        if dataset.workflow_state:
            dataset.workflow_state.step_statuses["update_reconciliation"] = WorkflowStepStatus.COMPLETED
            dataset.workflow_state.step_timestamps["update_reconciliation"] = datetime.now()
            dataset.workflow_state.step_operators["update_reconciliation"] = operator

        return results

    def _generate_auto_reconciliation_note(self, record: ForecastRecord,
                                           mismatch_reason: str) -> str:
        parts = [
            f"对账说明自动生成 - 记录ID: {record.record_id}",
            f"供应商: {record.supplier_name}",
            f"发票金额: {record.invoice_amount:,.2f}",
            f"原始账期: {record.original_settlement_cycle.value} -> "
            f"当前账期: {record.current_settlement_cycle.value}",
            f"原始到账日: {record.original_arrival_date.isoformat()} -> "
            f"预计到账日: {record.expected_arrival_date.isoformat()}",
        ]

        if record.is_manually_modified:
            parts.append(f"⚠️ 手工修改: {record.modification_reason or '原因未明'}")
            parts.append(f"修改人: {record.modified_by or '未知'}")

        if record.holiday_deferral_applies:
            parts.append(f"📅 节假日顺延: {record.holiday_deferral_explanation or '说明未明'}")

        parts.append(f"匹配问题: {mismatch_reason}")
        parts.append("请业务同事补充说明后标记为已对账")

        return "\n".join(parts)

    def mark_reconciled(self, dataset: ForecastDataset,
                        note_id: str,
                        reconciled_by: str,
                        reconciliation_note: Optional[str] = None) -> bool:
        note = next((n for n in dataset.reconciliation_notes if n.note_id == note_id), None)
        if not note:
            return False

        note.is_reconciled = True
        note.reconciled_by = reconciled_by
        note.reconciled_timestamp = datetime.now()

        if reconciliation_note:
            note.note_content += f"\n\n对账确认备注: {reconciliation_note}"
            note.updated_by = reconciled_by
            note.updated_timestamp = datetime.now()

        history = ChangeHistory(
            history_id=f"hist_{uuid.uuid4().hex[:8]}",
            record_id=note.record_id,
            batch_id=note.batch_id,
            field_changed="reconciliation_status",
            old_value="未对账",
            new_value="已对账",
            changed_by=reconciled_by,
            change_timestamp=datetime.now(),
            change_reason=reconciliation_note or "对账完成，标记为已对账",
        )
        dataset.change_history.append(history)

        return True

    def verify_historical_consistency(self, dataset: ForecastDataset,
                                      record: ForecastRecord) -> Tuple[bool, List[str]]:
        change_history = dataset.get_change_history_for_record(record.record_id)
        notes = dataset.get_notes_for_record(record.record_id)
        issues = []

        if record.is_manually_modified:
            has_modification_history = any(
                h.field_changed in ["settlement_cycle", "arrival_date"]
                for h in change_history
            )
            if not has_modification_history:
                issues.append("记录有手工修改标记但缺少变更历史记录")

            has_modification_note = any(
                "T+2" in n.note_content or "手工" in n.note_content
                for n in notes
            )
            if not has_modification_note:
                issues.append("记录有手工修改标记但对账说明未提及")

        if record.holiday_deferral_applies:
            has_holiday_note = any(
                "节假日" in n.note_content or "顺延" in n.note_content
                for n in notes
            )
            if not has_holiday_note:
                issues.append("记录有节假日顺延但对账说明未提及")

        return len(issues) == 0, issues

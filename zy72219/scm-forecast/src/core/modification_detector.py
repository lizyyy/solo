import uuid
from datetime import datetime, date
from pathlib import Path
import sys
from typing import List, Optional, Dict, Tuple

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from src.models import (
    ForecastDataset,
    ForecastRecord,
    SettlementCycle,
    ModificationStatus,
    ConflictEvidence,
    ChangeHistory,
)


class T1toT2ModificationDetector:
    def __init__(self):
        self.pending_manager_review: List[str] = []

    def detect_t1_to_t2_changes(self, dataset: ForecastDataset) -> List[ForecastRecord]:
        modified_records = []
        for record in dataset.records:
            if (record.original_settlement_cycle == SettlementCycle.T1 and
                    record.current_settlement_cycle == SettlementCycle.T2 and
                    record.is_manually_modified):
                modified_records.append(record)
                if record.modification_status == ModificationStatus.NORMAL:
                    record.modification_status = ModificationStatus.PENDING_REVIEW
                    self.pending_manager_review.append(record.record_id)
        return modified_records

    def generate_conflict_evidence(self, dataset: ForecastDataset,
                                   record: ForecastRecord) -> Optional[ConflictEvidence]:
        if not (record.original_settlement_cycle == SettlementCycle.T1 and
                record.current_settlement_cycle == SettlementCycle.T2):
            return None

        if record.holiday_deferral_applies and record.holiday_deferral_explanation:
            from src.core.holiday_validator import HolidayDeferralValidator
            validator = HolidayDeferralValidator()
            is_valid_holiday = validator.validate_deferral_explanation(
                record.original_arrival_date,
                record.expected_arrival_date,
                record.holiday_deferral_explanation
            )

            if not is_valid_holiday:
                return ConflictEvidence(
                    conflict_id=f"conflict_{uuid.uuid4().hex[:8]}",
                    batch_id=record.batch_id,
                    record_id=record.record_id,
                    conflict_type="batch_vs_holiday_explanation",
                    evidence_description=(
                        "清算批次号显示T+1到账被手工改为T+2，但节假日顺延说明与"
                        "实际到账日期变化不一致，存在矛盾"
                    ),
                    field_a_name="current_settlement_cycle (手工修改后)",
                    field_a_value=record.current_settlement_cycle.value,
                    field_b_name="holiday_deferral_explanation",
                    field_b_value=record.holiday_deferral_explanation,
                    resolution_status="pending",
                    requires_manager_review=True,
                )

        return ConflictEvidence(
            conflict_id=f"conflict_{uuid.uuid4().hex[:8]}",
            batch_id=record.batch_id,
            record_id=record.record_id,
            conflict_type="manual_modification_t1_to_t2",
            evidence_description="T+1到账被手工改为T+2，需要基金经理复核确认，暂不归为正常",
            field_a_name="original_settlement_cycle",
            field_a_value=record.original_settlement_cycle.value,
            field_b_name="current_settlement_cycle",
            field_b_value=record.current_settlement_cycle.value,
            resolution_status="pending",
            requires_manager_review=True,
        )

    def generate_change_history(self, record: ForecastRecord,
                                reason: str, operator: str) -> ChangeHistory:
        return ChangeHistory(
            history_id=f"hist_{uuid.uuid4().hex[:8]}",
            record_id=record.record_id,
            batch_id=record.batch_id,
            field_changed="settlement_cycle",
            old_value=record.original_settlement_cycle.value,
            new_value=record.current_settlement_cycle.value,
            changed_by=operator,
            change_timestamp=datetime.now(),
            change_reason=reason,
        )

    def process_modifications(self, dataset: ForecastDataset,
                              operator: str = "风控值班老秦") -> Dict[str, int]:
        modified_records = self.detect_t1_to_t2_changes(dataset)

        for record in modified_records:
            if not any(c.record_id == record.record_id for c in dataset.conflicts):
                conflict = self.generate_conflict_evidence(dataset, record)
                if conflict:
                    dataset.conflicts.append(conflict)

            if not any(h.record_id == record.record_id and h.field_changed == "settlement_cycle"
                       for h in dataset.change_history):
                history = self.generate_change_history(
                    record,
                    record.modification_reason or "T+1手工改为T+2，待复核",
                    operator
                )
                dataset.change_history.append(history)

        if dataset.workflow_state:
            dataset.workflow_state.t1_to_t2_records = [r.record_id for r in modified_records]
            dataset.workflow_state.modifications_found = [r.record_id for r in modified_records]
            if modified_records:
                dataset.workflow_state.requires_manager_review = True

        return {
            "total_modified": len(modified_records),
            "conflicts_created": len(dataset.conflicts),
            "history_entries_created": len(dataset.change_history),
        }

    def present_resolution_choice(self, conflict: ConflictEvidence) -> Dict:
        return {
            "conflict_id": conflict.conflict_id,
            "record_id": conflict.record_id,
            "conflict_type": conflict.conflict_type,
            "description": conflict.evidence_description,
            "field_a": f"{conflict.field_a_name}: {conflict.field_a_value}",
            "field_b": f"{conflict.field_b_name}: {conflict.field_b_value}",
            "options": [
                {"action": "confirm", "label": "确认修改有效，T+2生效"},
                {"action": "reject", "label": "驳回修改，恢复T+1"},
            ],
            "warning": "不要替业务同事自动拍板，请风控值班老秦选择确认或驳回",
            "requires_manager_review": conflict.requires_manager_review,
        }

    def resolve_conflict(self, dataset: ForecastDataset, conflict_id: str,
                         action: str, operator: str,
                         review_note: Optional[str] = None) -> bool:
        conflict = next((c for c in dataset.conflicts if c.conflict_id == conflict_id), None)
        if not conflict:
            return False

        record = dataset.get_record_by_id(conflict.record_id)
        if not record:
            return False

        if action == "confirm":
            conflict.resolution_status = "confirmed"
            conflict.resolved_by = operator
            conflict.resolved_timestamp = datetime.now()
            conflict.resolution = "确认修改有效"
            record.modification_status = ModificationStatus.CONFIRMED
            record.review_note = review_note or f"由{operator}确认T+2修改有效"

            history = ChangeHistory(
                history_id=f"hist_{uuid.uuid4().hex[:8]}",
                record_id=record.record_id,
                batch_id=record.batch_id,
                field_changed="modification_status",
                old_value=ModificationStatus.PENDING_REVIEW.value,
                new_value=ModificationStatus.CONFIRMED.value,
                changed_by=operator,
                change_timestamp=datetime.now(),
                change_reason=f"风控值班老秦确认修改: {review_note or '无额外说明'}",
            )
            dataset.change_history.append(history)

        elif action == "reject":
            conflict.resolution_status = "rejected"
            conflict.resolved_by = operator
            conflict.resolved_timestamp = datetime.now()
            conflict.resolution = "驳回修改，恢复T+1"
            record.current_settlement_cycle = record.original_settlement_cycle
            record.expected_arrival_date = record.original_arrival_date
            record.is_manually_modified = False
            record.modification_status = ModificationStatus.NORMAL
            record.modification_reason = None
            record.review_note = review_note or f"由{operator}驳回，恢复原始T+1"
            record.holiday_deferral_applies = False
            record.holiday_deferral_explanation = None

            history = ChangeHistory(
                history_id=f"hist_{uuid.uuid4().hex[:8]}",
                record_id=record.record_id,
                batch_id=record.batch_id,
                field_changed="settlement_cycle",
                old_value=SettlementCycle.T2.value,
                new_value=SettlementCycle.T1.value,
                changed_by=operator,
                change_timestamp=datetime.now(),
                change_reason=f"风控值班老秦驳回修改，恢复T+1: {review_note or '无额外说明'}",
            )
            dataset.change_history.append(history)

            if conflict.record_id in self.pending_manager_review:
                self.pending_manager_review.remove(conflict.record_id)

        else:
            return False

        if dataset.workflow_state:
            if (not any(c.resolution_status == "pending" for c in dataset.conflicts) and
                    not self.pending_manager_review):
                dataset.workflow_state.requires_manager_review = False

        return True

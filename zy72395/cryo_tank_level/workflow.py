from typing import List, Optional, Dict, Any
from datetime import datetime
from .models import (
    LevelConversionRecord,
    SafetyThreshold,
    WorkflowState,
    ReviewStatus,
    ChangeHistory,
)
from .storage import JsonStorage
from .errors import CryoTankError, error_message
from .core import CryoTankLevelSystem
import uuid


class ThreeStepWorkflow:
    def __init__(self, system: CryoTankLevelSystem):
        self.system = system
        self.storage = system.storage

    def get_workflow_state(self, record_id: str) -> Optional[WorkflowState]:
        record = self.storage.get_level_record(record_id)
        if record:
            return record.workflow_state
        return None

    def can_advance(self, record_id: str, target_state: WorkflowState) -> bool:
        current = self.get_workflow_state(record_id)
        if current is None:
            return False
        state_order = [
            WorkflowState.STEP_1_NOTES_IMPORTED,
            WorkflowState.STEP_2_THRESHOLD_REVIEWED,
            WorkflowState.STEP_3_SAFETY_UPDATED,
        ]
        current_idx = state_order.index(current) if current in state_order else -1
        target_idx = state_order.index(target_state) if target_state in state_order else -1
        return target_idx == current_idx + 1

    def step_2_review_threshold(
        self,
        record_id: str,
        threshold_verified: bool,
        reviewed_by: str = "老唐",
        review_notes: str = "",
    ) -> LevelConversionRecord:
        record = self.storage.get_level_record(record_id)
        if not record:
            raise CryoTankError(
                error_message("NOTE_NOT_FOUND", note_id=record_id),
                code="NOTE_NOT_FOUND",
            )

        if record.status == ReviewStatus.PENDING_REVIEW:
            raise CryoTankError(
                error_message("RECORD_UNDER_REVIEW"),
                code="RECORD_UNDER_REVIEW",
            )

        if not self.can_advance(record_id, WorkflowState.STEP_2_THRESHOLD_REVIEWED):
            current = self.get_workflow_state(record_id)
            current_name = self._state_name(current)
            raise CryoTankError(
                error_message("WORKFLOW_NOT_READY", current_step=current_name),
                code="WORKFLOW_NOT_READY",
            )

        if not threshold_verified:
            record.review_notes = f"阈值复核未通过: {review_notes}"
            record.updated_at = datetime.now()
            self.storage.save_level_record(record)
            return record

        record.workflow_state = WorkflowState.STEP_2_THRESHOLD_REVIEWED
        record.updated_at = datetime.now()
        record.review_notes = f"阈值复核通过，复核人：{reviewed_by}"
        if review_notes:
            record.review_notes += f"，备注：{review_notes}"
        self.storage.save_level_record(record)

        history = ChangeHistory(
            history_id=str(uuid.uuid4()),
            record_id=record_id,
            field_name="workflow_state",
            old_value=WorkflowState.STEP_1_NOTES_IMPORTED.value,
            new_value=WorkflowState.STEP_2_THRESHOLD_REVIEWED.value,
            changed_by=reviewed_by,
            change_reason="安全阈值表复核完成",
        )
        self.storage.save_change_history(history)

        return record

    def step_3_update_safety_reminder(
        self,
        record_id: str,
        safety_note: str,
        updated_by: str = "老唐",
    ) -> LevelConversionRecord:
        record = self.storage.get_level_record(record_id)
        if not record:
            raise CryoTankError(
                error_message("NOTE_NOT_FOUND", note_id=record_id),
                code="NOTE_NOT_FOUND",
            )

        if record.status == ReviewStatus.PENDING_REVIEW:
            raise CryoTankError(
                error_message("RECORD_UNDER_REVIEW"),
                code="RECORD_UNDER_REVIEW",
            )

        if not self.can_advance(record_id, WorkflowState.STEP_3_SAFETY_UPDATED):
            current = self.get_workflow_state(record_id)
            current_name = self._state_name(current)
            raise CryoTankError(
                error_message("WORKFLOW_NOT_READY", current_step=current_name),
                code="WORKFLOW_NOT_READY",
            )

        old_state = record.workflow_state
        record.workflow_state = WorkflowState.STEP_3_SAFETY_UPDATED
        record.updated_at = datetime.now()
        if record.review_notes:
            record.review_notes += f" | 安全提醒：{safety_note}"
        else:
            record.review_notes = f"安全提醒：{safety_note}"
        self.storage.save_level_record(record)

        history = ChangeHistory(
            history_id=str(uuid.uuid4()),
            record_id=record_id,
            field_name="workflow_state",
            old_value=old_state.value,
            new_value=WorkflowState.STEP_3_SAFETY_UPDATED.value,
            changed_by=updated_by,
            change_reason=f"安全提醒更新: {safety_note}",
        )
        self.storage.save_change_history(history)

        return record

    def get_records_at_state(self, state: WorkflowState) -> List[LevelConversionRecord]:
        all_records = self.storage.get_all_level_records()
        return [r for r in all_records if r.workflow_state == state]

    def get_pending_safety_review(self) -> List[Dict[str, Any]]:
        pending = []
        for mapping in self.storage.get_sensor_mappings_pending():
            records = self.storage.get_level_records_by_sensor(mapping.new_sensor_id)
            for record in records:
                note = self.storage.get_inspection_note(record.original_note_id)
                pending.append({
                    "mapping": mapping,
                    "record": record,
                    "note": note,
                    "needs_attention": True,
                })
        return pending

    def _state_name(self, state: Optional[WorkflowState]) -> str:
        names = {
            WorkflowState.STEP_1_NOTES_IMPORTED: "第一步：巡检备注导入",
            WorkflowState.STEP_2_THRESHOLD_REVIEWED: "第二步：安全阈值复核",
            WorkflowState.STEP_3_SAFETY_UPDATED: "第三步：安全提醒更新",
        }
        return names.get(state, "未知状态")

    def get_workflow_summary(self, record_id: str) -> Dict[str, Any]:
        record = self.storage.get_level_record(record_id)
        if not record:
            return {}

        history = self.system.get_change_history(record_id)
        note = self.storage.get_inspection_note(record.original_note_id)
        threshold = None
        if record.threshold_id:
            threshold = self.storage.get_safety_threshold(record.threshold_id)

        return {
            "record_id": record_id,
            "current_state": record.workflow_state,
            "current_state_name": self._state_name(record.workflow_state),
            "status": record.status,
            "converted_level": record.converted_level,
            "raw_level": record.raw_level,
            "review_notes": record.review_notes,
            "note": note,
            "threshold": threshold,
            "change_history": history,
            "next_available": self._get_next_steps(record.workflow_state),
            "is_pending_review": record.status == ReviewStatus.PENDING_REVIEW,
        }

    def _get_next_steps(self, current_state: WorkflowState) -> List[str]:
        transitions = {
            WorkflowState.STEP_1_NOTES_IMPORTED: ["第二步：安全阈值复核"],
            WorkflowState.STEP_2_THRESHOLD_REVIEWED: ["第三步：安全提醒更新"],
            WorkflowState.STEP_3_SAFETY_UPDATED: ["（全部完成）"],
        }
        return transitions.get(current_state, [])

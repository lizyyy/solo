"""
工作流引擎 - 管理三步工作流和复核机制
"""
from typing import Optional, Dict, Any, List
from datetime import datetime

from .models import (
    SnapshotRecord,
    ProcessingStatus,
    WorkflowStep,
    WorkflowState,
)
from .snapshot_manager import SnapshotManager
from .history_tracker import HistoryTracker
from .boundary_rules import BoundaryRuleEngine


class WorkflowEngine:
    def __init__(
        self,
        snapshot_manager: SnapshotManager,
        history_tracker: HistoryTracker,
        rule_engine: BoundaryRuleEngine,
    ):
        self.snapshot_manager = snapshot_manager
        self.history_tracker = history_tracker
        self.rule_engine = rule_engine

    def _transition_step(
        self,
        snapshot_id: str,
        next_step: WorkflowStep,
        actor: str,
        notes: str = "",
    ) -> Optional[SnapshotRecord]:
        record = self.snapshot_manager.get_snapshot(snapshot_id)
        if not record:
            return None

        old_record = SnapshotRecord.from_dict(record.to_dict())

        record.workflow_step = next_step
        record.workflow_state = WorkflowState.IN_PROGRESS

        if notes:
            record.notes = notes

        self.history_tracker.record_changes_from_update(
            old_record, record, actor, f"工作流转到 {next_step.value}"
        )
        self.history_tracker.record_audit(
            snapshot_id,
            action=f"workflow_transition",
            actor=actor,
            details={
                "from_step": old_record.workflow_step.value,
                "to_step": next_step.value,
                "notes": notes,
            },
            before_state=old_record.to_dict(),
            after_state=record.to_dict(),
        )

        self.snapshot_manager._save_records()
        return record

    def step_1_import(
        self,
        snapshot_id: str,
        imported_by: str,
        import_notes: str = "",
    ) -> Optional[SnapshotRecord]:
        record = self.snapshot_manager.get_snapshot(snapshot_id)
        if not record:
            return None

        old_record = SnapshotRecord.from_dict(record.to_dict())

        record.status = ProcessingStatus.IMPORTED
        record.workflow_step = WorkflowStep.STEP_1_IMPORT
        record.workflow_state = WorkflowState.COMPLETED

        if import_notes:
            record.notes = import_notes

        rule_result = self.rule_engine.apply_rules(record, applied_by=imported_by)

        self.history_tracker.record_changes_from_update(
            old_record, record, imported_by, "完成第一步：特征快照导入"
        )
        self.history_tracker.record_audit(
            snapshot_id,
            action="step_1_import_complete",
            actor=imported_by,
            details={
                "notes": import_notes,
                "rules_applied": rule_result,
            },
            before_state=old_record.to_dict(),
            after_state=record.to_dict(),
        )

        self.snapshot_manager._save_records()
        return record

    def step_2_review_logs(
        self,
        snapshot_id: str,
        reviewed_by: str,
        training_log_analysis: str,
        curve_findings: str = "",
    ) -> Optional[SnapshotRecord]:
        record = self.snapshot_manager.get_snapshot(snapshot_id)
        if not record:
            return None

        if record.workflow_step not in [
            WorkflowStep.STEP_1_IMPORT,
            WorkflowStep.STEP_2_REVIEW_LOGS,
        ]:
            raise ValueError(
                f"当前处于 {record.workflow_step.value}，无法进行日志审阅"
            )

        old_record = SnapshotRecord.from_dict(record.to_dict())

        record.status = ProcessingStatus.LOGS_REVIEWED
        record.workflow_step = WorkflowStep.STEP_2_REVIEW_LOGS
        record.workflow_state = WorkflowState.COMPLETED
        record.custom_fields["training_log_analysis"] = training_log_analysis
        record.custom_fields["curve_findings"] = curve_findings
        record.custom_fields["logs_reviewed_by"] = reviewed_by
        record.custom_fields["logs_reviewed_at"] = datetime.now().isoformat()

        self.history_tracker.record_changes_from_update(
            old_record, record, reviewed_by, "完成第二步：训练日志曲线审阅"
        )
        self.history_tracker.record_audit(
            snapshot_id,
            action="step_2_logs_reviewed",
            actor=reviewed_by,
            details={
                "training_log_analysis": training_log_analysis,
                "curve_findings": curve_findings,
            },
            before_state=old_record.to_dict(),
            after_state=record.to_dict(),
        )

        self.snapshot_manager._save_records()
        return record

    def step_3_update_summary(
        self,
        snapshot_id: str,
        updated_by: str,
        explainable_summary: str,
        click_bias_score: Optional[float] = None,
        missing_features: Optional[List[str]] = None,
        default_score_applied: bool = False,
    ) -> Optional[SnapshotRecord]:
        record = self.snapshot_manager.get_snapshot(snapshot_id)
        if not record:
            return None

        if record.workflow_step not in [
            WorkflowStep.STEP_2_REVIEW_LOGS,
            WorkflowStep.STEP_3_UPDATE_SUMMARY,
        ]:
            raise ValueError(
                f"当前处于 {record.workflow_step.value}，无法更新摘要"
            )

        old_record = SnapshotRecord.from_dict(record.to_dict())

        record.workflow_step = WorkflowStep.STEP_3_UPDATE_SUMMARY
        record.workflow_state = WorkflowState.COMPLETED
        record.custom_fields["explainable_summary"] = explainable_summary
        record.custom_fields["summary_updated_by"] = updated_by
        record.custom_fields["summary_updated_at"] = datetime.now().isoformat()

        if click_bias_score is not None:
            record.click_bias_score = click_bias_score
        if missing_features is not None:
            record.missing_features = missing_features
        record.default_score_applied = default_score_applied

        rule_result = self.rule_engine.apply_rules(record, applied_by=updated_by)

        needs_review = record.status == ProcessingStatus.NEEDS_REVIEW
        if not needs_review:
            record.status = ProcessingStatus.SUMMARY_UPDATED

        self.history_tracker.record_changes_from_update(
            old_record, record, updated_by, "完成第三步：可解释摘要更新"
        )
        self.history_tracker.record_audit(
            snapshot_id,
            action="step_3_summary_updated",
            actor=updated_by,
            details={
                "explainable_summary": explainable_summary,
                "click_bias_score": click_bias_score,
                "missing_features": missing_features,
                "default_score_applied": default_score_applied,
                "needs_review": needs_review,
                "rules_applied": rule_result,
            },
            before_state=old_record.to_dict(),
            after_state=record.to_dict(),
        )

        self.snapshot_manager._save_records()
        return record

    def assign_for_review(
        self,
        snapshot_id: str,
        assigned_to: str,
        assigned_by: str,
        review_reason: str = "",
    ) -> Optional[SnapshotRecord]:
        record = self.snapshot_manager.get_snapshot(snapshot_id)
        if not record:
            return None

        old_record = SnapshotRecord.from_dict(record.to_dict())

        record.status = ProcessingStatus.NEEDS_REVIEW
        record.assigned_to = assigned_to
        record.workflow_state = WorkflowState.BLOCKED
        if review_reason:
            record.notes = review_reason

        self.history_tracker.record_changes_from_update(
            old_record, record, assigned_by, f"分配复核给 {assigned_to}"
        )
        self.history_tracker.record_audit(
            snapshot_id,
            action="assigned_for_review",
            actor=assigned_by,
            details={
                "assigned_to": assigned_to,
                "reason": review_reason,
            },
            before_state=old_record.to_dict(),
            after_state=record.to_dict(),
        )

        self.snapshot_manager._save_records()
        return record

    def approve_review(
        self,
        snapshot_id: str,
        reviewed_by: str,
        approval_notes: str = "",
        mark_as_normal: bool = True,
    ) -> Optional[SnapshotRecord]:
        record = self.snapshot_manager.get_snapshot(snapshot_id)
        if not record:
            return None

        old_record = SnapshotRecord.from_dict(record.to_dict())

        record.status = ProcessingStatus.REVIEW_APPROVED
        record.reviewed_by = reviewed_by
        record.reviewed_at = datetime.now()
        record.workflow_state = WorkflowState.COMPLETED

        if mark_as_normal:
            record.status = ProcessingStatus.NORMAL

        if approval_notes:
            record.notes = approval_notes

        self.history_tracker.record_changes_from_update(
            old_record, record, reviewed_by, "复核通过"
        )
        self.history_tracker.record_audit(
            snapshot_id,
            action="review_approved",
            actor=reviewed_by,
            details={
                "notes": approval_notes,
                "mark_as_normal": mark_as_normal,
            },
            before_state=old_record.to_dict(),
            after_state=record.to_dict(),
        )

        self.snapshot_manager._save_records()
        return record

    def reject_review(
        self,
        snapshot_id: str,
        reviewed_by: str,
        rejection_notes: str,
        send_back_to_step: Optional[WorkflowStep] = None,
    ) -> Optional[SnapshotRecord]:
        record = self.snapshot_manager.get_snapshot(snapshot_id)
        if not record:
            return None

        old_record = SnapshotRecord.from_dict(record.to_dict())

        record.status = ProcessingStatus.REVIEW_REJECTED
        record.reviewed_by = reviewed_by
        record.reviewed_at = datetime.now()
        record.notes = rejection_notes

        if send_back_to_step:
            record.workflow_step = send_back_to_step
            record.workflow_state = WorkflowState.IN_PROGRESS

        self.history_tracker.record_changes_from_update(
            old_record, record, reviewed_by, f"复核驳回: {rejection_notes}"
        )
        self.history_tracker.record_audit(
            snapshot_id,
            action="review_rejected",
            actor=reviewed_by,
            details={
                "notes": rejection_notes,
                "send_back_to_step": send_back_to_step.value if send_back_to_step else None,
            },
            before_state=old_record.to_dict(),
            after_state=record.to_dict(),
        )

        self.snapshot_manager._save_records()
        return record

    def get_workflow_status(self, snapshot_id: str) -> Optional[Dict[str, Any]]:
        record = self.snapshot_manager.get_snapshot(snapshot_id)
        if not record:
            return None

        return {
            "snapshot_id": snapshot_id,
            "current_step": record.workflow_step.value,
            "current_state": record.workflow_state.value,
            "status": record.status.value,
            "assigned_to": record.assigned_to,
            "reviewed_by": record.reviewed_by,
            "notes": record.notes,
            "missing_features": record.missing_features,
            "default_score_applied": record.default_score_applied,
            "needs_leader_review": record.status == ProcessingStatus.NEEDS_REVIEW,
        }

    def list_snapshots_by_workflow_step(
        self,
        step: WorkflowStep,
        state: Optional[WorkflowState] = None,
    ) -> List[SnapshotRecord]:
        records = self.snapshot_manager.list_snapshots(workflow_step=step)
        if state:
            records = [r for r in records if r.workflow_state == state]
        return records

    def get_workflow_statistics(self) -> Dict[str, Any]:
        stats = {}
        for step in WorkflowStep:
            for state in WorkflowState:
                count = len(
                    [
                        r
                        for r in self.snapshot_manager.list_snapshots()
                        if r.workflow_step == step and r.workflow_state == state
                    ]
                )
                if count > 0:
                    key = f"{step.value}_{state.value}"
                    stats[key] = count

        needs_review = len(
            [
                r
                for r in self.snapshot_manager.list_snapshots()
                if r.status == ProcessingStatus.NEEDS_REVIEW
            ]
        )

        return {
            "by_step_and_state": stats,
            "needs_leader_review": needs_review,
        }

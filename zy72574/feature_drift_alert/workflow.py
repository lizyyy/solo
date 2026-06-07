from typing import List, Dict, Optional
from .models import (
    Alert,
    TrainingLog,
    ThresholdNote,
    AlertStatus,
    FeatureScore,
)
from .rules import BoundaryRules
from .storage import AlertStorage, generate_id


class WorkflowStep:
    IMPORT_LOGS = "import_logs"
    REVIEW_THRESHOLD_NOTES = "review_threshold_notes"
    COMPARE_EXPERIMENTS = "compare_experiments"


class WorkflowEngine:
    def __init__(self, storage: AlertStorage):
        self.storage = storage
        self._workflow_state: Dict[str, Dict] = {}

    def step1_import_training_log(
        self,
        experiment_name: str,
        model_version: str,
        feature_scores: List[FeatureScore],
        author: str,
    ) -> dict:
        log_id = generate_id()
        training_log = TrainingLog(
            log_id=log_id,
        experiment_name=experiment_name,
        model_version=model_version,
        feature_scores=feature_scores,
        )

        imported, existing_or_existing_id = self.storage.import_training_log(training_log)

        if not imported:
            existing_log = self.storage.get_training_log(existing_or_existing_id)
            existing_alerts = self.storage.get_alerts_for_log(existing_or_existing_id)
            return {
                "step": WorkflowStep.IMPORT_LOGS,
                "is_duplicate": True,
                "existing_log_id": existing_or_existing_id,
                "existing_alerts_count": len(existing_alerts),
                "message": f"训练日志已存在（相同实验数据未重复导入，报警数量未翻倍",
            }

        alerts = BoundaryRules.evaluate_batch(feature_scores, log_id)
        for alert in alerts:
            self.storage.add_alert(alert)

        self._workflow_state[log_id] = {
            "current_step": WorkflowStep.REVIEW_THRESHOLD_NOTES,
            "author": author,
            "pending_alerts": [a.alert_id for a in alerts if a.status == AlertStatus.PENDING_REVIEW],
        }

        return {
            "step": WorkflowStep.IMPORT_LOGS,
            "is_duplicate": False,
            "log_id": log_id,
            "total_alerts": len(alerts),
            "pending_review_count": len(self._workflow_state[log_id]["pending_alerts"]),
            "confirmed_drift_count": len([a for a in alerts if a.status == AlertStatus.CONFIRMED_DRIFT]),
            "next_step": WorkflowStep.REVIEW_THRESHOLD_NOTES,
            "message": f"导入完成，{len(alerts)}条报警，其中{len(self._workflow_state[log_id]['pending_alerts'])}条待复核",
        }

    def step2_review_threshold_notes(
        self,
        log_id: str,
        alert_id: str,
        note_id: Optional[str] = None,
        new_note_title: Optional[str] = None,
        new_note_content: Optional[str] = None,
        reviewer: str = "林姐",
    ) -> dict:
        alert = self.storage.get_alert(alert_id)
        if not alert:
            return {"error": "报警不存在"}

        if alert.bucket_diff == 1 and alert.status != AlertStatus.PENDING_REVIEW:
            return {
                "warning": "此报警已处理过，但仍可关联笔记",
            }

        if note_id:
            self.storage.link_note_to_alert(alert_id, note_id)
        elif new_note_title and new_note_content:
            note = ThresholdNote(
                note_id=generate_id(),
                feature_name=alert.feature_name,
                title=new_note_title,
                content=new_note_content,
                author=reviewer,
                related_log_ids=[log_id],
            )
            self.storage.add_threshold_note(note)
            self.storage.link_note_to_alert(alert_id, note.note_id)
            note_id = note.note_id

        if log_id in self._workflow_state:
            self._workflow_state[log_id]["current_step"] = WorkflowStep.COMPARE_EXPERIMENTS

        return {
            "step": WorkflowStep.REVIEW_THRESHOLD_NOTES,
            "alert_id": alert_id,
            "linked_note_id": note_id,
            "next_step": WorkflowStep.COMPARE_EXPERIMENTS,
            "message": "阈值笔记复核完成，可进入实验对比更新",
            "judgment_guideline": BoundaryRules.get_judgment_guideline(alert.bucket_diff),
        }

    def step3_compare_and_update(
        self,
        log_id: str,
        alert_id: str,
        is_confirmed_drift: bool,
        reviewer: str,
        reason: str,
    ) -> dict:
        alert = self.storage.get_alert(alert_id)
        if not alert:
            return {"error": "报警不存在"}

        if alert.bucket_diff == 1:
            BoundaryRules.resolve_one_bucket_diff(alert, is_confirmed_drift, reviewer, reason)
        else:
            new_status = AlertStatus.CONFIRMED_DRIFT if is_confirmed_drift else AlertStatus.FALSE_ALARM
            alert.update_status(new_status, reviewer, reason=reason)

        if log_id in self._workflow_state:
            pending = self._workflow_state[log_id].get("pending_alerts", [])
            if alert_id in pending:
                pending.remove(alert_id)

        return {
            "step": WorkflowStep.COMPARE_EXPERIMENTS,
            "alert_id": alert_id,
            "new_status": alert.status.value,
            "final_remark": alert.remark,
            "message": "实验对比完成，状态已更新",
            "can_rollback": True,
            "rollback_hint": "如需回滚可调用 storage.rollback_alert_status()",
        }

    def get_workflow_progress(self, log_id: str) -> dict:
        state = self._workflow_state.get(log_id, {})
        log = self.storage.get_training_log(log_id)
        alerts = self.storage.get_alerts_for_log(log_id) if log else []

        return {
            "log_id": log_id,
            "experiment_name": log.experiment_name if log else None,
            "current_step": state.get("current_step", WorkflowStep.IMPORT_LOGS),
            "author": state.get("author"),
            "pending_alerts": [
                {
                    "alert_id": a.alert_id,
                    "feature_name": a.feature_name,
                    "bucket_diff": a.bucket_diff,
                    "status": a.status.value,
                }
                for a in alerts
            ],
            "steps_completed": self._get_completed_steps(state),
        }

    def _get_completed_steps(self, state: dict) -> List[str]:
        current = state.get("current_step", WorkflowStep.IMPORT_LOGS)
        steps = [WorkflowStep.IMPORT_LOGS]
        if current in [WorkflowStep.REVIEW_THRESHOLD_NOTES, WorkflowStep.COMPARE_EXPERIMENTS]:
            steps.append(WorkflowStep.REVIEW_THRESHOLD_NOTES)
        if current == WorkflowStep.COMPARE_EXPERIMENTS:
            steps.append(WorkflowStep.COMPARE_EXPERIMENTS)
        return steps

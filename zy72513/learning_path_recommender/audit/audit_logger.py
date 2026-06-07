from typing import Dict, Any, List
from datetime import datetime
from ..storage import JSONStorage


class AuditLogger:
    def __init__(self, storage: JSONStorage):
        self.storage = storage

    def _log(self, event_type: str, data: Dict[str, Any]):
        entry = {
            "event_type": event_type,
            "data": data,
        }
        self.storage.append_audit_log(entry)

    def log_recommendation_create(
        self,
        recommendation_id: str,
        created_by: str,
        source: str,
        batch_id: str = None,
    ):
        self._log(
            "recommendation.create",
            {
                "recommendation_id": recommendation_id,
                "created_by": created_by,
                "source": source,
                "batch_id": batch_id,
            },
        )

    def log_recommendation_update(
        self,
        recommendation_id: str,
        field: str,
        old_value: Any,
        new_value: Any,
        updated_by: str,
        reason: str,
        source_batch: str = None,
    ):
        self._log(
            "recommendation.update",
            {
                "recommendation_id": recommendation_id,
                "field": field,
                "old_value": str(old_value)[:200] if old_value else None,
                "new_value": str(new_value)[:200] if new_value else None,
                "updated_by": updated_by,
                "reason": reason,
                "source_batch": source_batch,
            },
        )

    def log_duplicate_detection(
        self,
        recommendation_id: str,
        batch_id: str,
        detected_by: str,
        reason: str,
    ):
        self._log(
            "import.duplicate_detected",
            {
                "recommendation_id": recommendation_id,
                "batch_id": batch_id,
                "detected_by": detected_by,
                "reason": reason,
            },
        )

    def log_import_complete(
        self,
        batch_id: str,
        source_type: str,
        total: int,
        new: int,
        updated: int,
        duplicates: int,
        imported_by: str,
    ):
        self._log(
            "import.complete",
            {
                "batch_id": batch_id,
                "source_type": source_type,
                "total": total,
                "new": new,
                "updated": updated,
                "duplicates": duplicates,
                "imported_by": imported_by,
            },
        )

    def log_unmasked_detected(
        self,
        recommendation_id: str,
        detected_by: str,
        violation_type: str,
        matched_texts: List[str],
        severity: str,
    ):
        self._log(
            "masking.unmasked_detected",
            {
                "recommendation_id": recommendation_id,
                "detected_by": detected_by,
                "violation_type": violation_type,
                "matched_texts": matched_texts,
                "severity": severity,
            },
        )

    def log_masking_apply(
        self,
        recommendation_id: str,
        applied_by: str,
        method: str,
        original_content_preview: str,
        masked_content_preview: str,
    ):
        self._log(
            "masking.applied",
            {
                "recommendation_id": recommendation_id,
                "applied_by": applied_by,
                "method": method,
                "original_content_preview": original_content_preview,
                "masked_content_preview": masked_content_preview,
            },
        )

    def log_masking_rule_create(
        self,
        rule_id: str,
        rule_name: str,
        created_by: str,
    ):
        self._log(
            "masking.rule_created",
            {
                "rule_id": rule_id,
                "rule_name": rule_name,
                "created_by": created_by,
            },
        )

    def log_review_escalate(
        self,
        recommendation_id: str,
        escalated_by: str,
        escalate_to: str,
        reason: str,
        comment: str = None,
    ):
        self._log(
            "review.escalated",
            {
                "recommendation_id": recommendation_id,
                "escalated_by": escalated_by,
                "escalate_to": escalate_to,
                "reason": reason,
                "comment": comment,
            },
        )

    def log_export_skip(
        self,
        recommendation_id: str,
        reason: str,
        exported_by: str,
    ):
        self._log(
            "export.skipped",
            {
                "recommendation_id": recommendation_id,
                "reason": reason,
                "exported_by": exported_by,
            },
        )

    def log_export_complete(
        self,
        total_requested: int,
        exported: int,
        skipped: int,
        exported_by: str,
        include_unreviewed: bool,
    ):
        self._log(
            "export.complete",
            {
                "total_requested": total_requested,
                "exported": exported,
                "skipped": skipped,
                "exported_by": exported_by,
                "include_unreviewed": include_unreviewed,
            },
        )

    def log_rollback(
        self,
        recommendation_id: str,
        from_version: int,
        to_version: int,
        rolled_back_by: str,
    ):
        self._log(
            "version.rollback",
            {
                "recommendation_id": recommendation_id,
                "from_version": from_version,
                "to_version": to_version,
                "rolled_back_by": rolled_back_by,
            },
        )

    def log_workflow_step(
        self,
        workflow_name: str,
        step_name: str,
        status: str,
        operator: str,
        context: Dict[str, Any] = None,
    ):
        self._log(
            "workflow.step",
            {
                "workflow_name": workflow_name,
                "step_name": step_name,
                "status": status,
                "operator": operator,
                "context": context or {},
            },
        )

    def log_warning(
        self,
        message: str,
        context: Dict[str, Any] = None,
    ):
        self._log(
            "system.warning",
            {
                "message": message,
                "context": context or {},
            },
        )

    def get_logs(self, limit: int = 100) -> List[Dict[str, Any]]:
        return self.storage.get_audit_logs(limit=limit)

    def generate_replay_commands(self) -> List[str]:
        logs = self.get_logs(limit=1000)
        commands = []

        for log in logs:
            event_type = log.get("event_type", "")
            data = log.get("data", {})
            ts = log.get("timestamp", "")

            if event_type == "import.complete":
                cmd = f"# [{ts}] 导入批次 {data.get('batch_id')}: 总计 {data.get('total')} 条 (新增 {data.get('new')}, 更新 {data.get('updated')}, 重复 {data.get('duplicates')})"
                commands.append(cmd)
            elif event_type == "recommendation.update":
                cmd = f"# [{ts}] 更新 {data.get('recommendation_id')} 的 {data.get('field')}: 原因={data.get('reason')}, 操作人={data.get('updated_by')}"
                commands.append(cmd)
            elif event_type == "masking.unmasked_detected":
                cmd = f"# [{ts}] 发现未脱敏内容: {data.get('recommendation_id')}, 类型={data.get('violation_type')}, 匹配={data.get('matched_texts')}"
                commands.append(cmd)
            elif event_type == "review.escalated":
                cmd = f"# [{ts}] 升级复核: {data.get('recommendation_id')} -> {data.get('escalate_to')}, 原因={data.get('reason')}"
                commands.append(cmd)
            elif event_type == "version.rollback":
                cmd = f"# [{ts}] 回滚: {data.get('recommendation_id')} 从版本 {data.get('from_version')} 回滚到 {data.get('to_version')}"
                commands.append(cmd)

        return commands

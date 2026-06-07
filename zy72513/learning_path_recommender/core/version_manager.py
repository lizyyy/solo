from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
from ..models import VersionHistory, Recommendation
from ..storage import JSONStorage
from ..audit import AuditLogger


class VersionManager:
    def __init__(self, storage: JSONStorage, audit_logger: AuditLogger):
        self.storage = storage
        self.audit = audit_logger

    def record_change(
        self,
        recommendation_id: str,
        field_name: str,
        old_value: Optional[str],
        new_value: Optional[str],
        changed_by: str,
        change_reason: str,
        source: str = None,
    ) -> VersionHistory:
        recommendation = self.storage.get_recommendation(recommendation_id)
        if not recommendation:
            raise ValueError(f"Recommendation not found: {recommendation_id}")

        new_version = recommendation.version

        history = VersionHistory(
            recommendation_id=recommendation_id,
            version=new_version,
            previous_version=new_version - 1 if new_version > 1 else None,
            field_name=field_name,
            old_value=old_value,
            new_value=new_value,
            change_summary=f"{field_name}: {self._truncate(old_value)} -> {self._truncate(new_value)}",
            changed_by=changed_by,
            change_reason=change_reason,
            source=source,
        )
        self.storage.save_version_history(history)
        return history

    def _truncate(self, value: Optional[str], max_len: int = 50) -> str:
        if value is None:
            return "None"
        if len(value) <= max_len:
            return value
        return value[:max_len] + "..."

    def get_history(self, recommendation_id: str) -> List[VersionHistory]:
        return self.storage.get_version_history(recommendation_id)

    def compare_versions(
        self, recommendation_id: str, version_a: int, version_b: int
    ) -> List[Dict[str, Any]]:
        histories = self.get_history(recommendation_id)
        diffs = []

        for h in histories:
            if h.version == version_b:
                diffs.append(
                    {
                        "field": h.field_name,
                        "version_a": version_a,
                        "version_b": version_b,
                        "old_value": h.old_value,
                        "new_value": h.new_value,
                        "changed_by": h.changed_by,
                        "changed_at": h.changed_at.isoformat(),
                        "reason": h.change_reason,
                    }
                )

        return diffs

    def get_version_snapshot(
        self, recommendation_id: str, target_version: int
    ) -> Optional[Dict[str, Any]]:
        recommendation = self.storage.get_recommendation(recommendation_id)
        if not recommendation:
            return None

        if recommendation.version == target_version:
            return recommendation.to_dict()

        histories = self.get_history(recommendation_id)
        current = recommendation.to_dict()

        for h in reversed(histories):
            if h.version <= target_version:
                break
            if h.field_name and h.field_name in current:
                current[h.field_name] = h.old_value

        current["version"] = target_version
        return current

    def rollback_to_version(
        self, recommendation_id: str, target_version: int, rolled_back_by: str
    ) -> Tuple[Recommendation, List[Dict[str, Any]]]:
        snapshot = self.get_version_snapshot(recommendation_id, target_version)
        if not snapshot:
            raise ValueError(f"Version {target_version} not found for {recommendation_id}")

        recommendation = self.storage.get_recommendation(recommendation_id)
        if not recommendation:
            raise ValueError(f"Recommendation not found: {recommendation_id}")

        changes = []
        fields_to_rollback = ["content", "source_model_output", "source_manual_review", "masking_status", "review_status", "review_comment"]

        for field in fields_to_rollback:
            old_val = getattr(recommendation, field)
            new_val = snapshot.get(field)
            if old_val != new_val:
                setattr(recommendation, field, new_val)
                changes.append({"field": field, "old_value": old_val, "new_value": new_val})

        recommendation.version += 1
        recommendation.updated_at = datetime.now()
        self.storage.save_recommendation(recommendation)

        for change in changes:
            self.record_change(
                recommendation_id=recommendation_id,
                field_name=change["field"],
                old_value=change["old_value"],
                new_value=change["new_value"],
                changed_by=rolled_back_by,
                change_reason=f"rollback to version {target_version}",
                source="rollback",
            )

        self.audit.log_rollback(
            recommendation_id=recommendation_id,
            from_version=recommendation.version - 1,
            to_version=target_version,
            rolled_back_by=rolled_back_by,
        )

        return recommendation, changes

    def show_change_diff(self, recommendation_id: str) -> str:
        histories = self.get_history(recommendation_id)
        if not histories:
            return "No version history found."

        lines = [f"=== 版本历史: {recommendation_id} ==="]
        for h in histories:
            lines.append(f"\n--- 版本 {h.version} (前版本: {h.previous_version}) ---")
            lines.append(f"修改人: {h.changed_by}")
            lines.append(f"修改时间: {h.changed_at.isoformat()}")
            lines.append(f"修改原因: {h.change_reason}")
            lines.append(f"字段: {h.field_name}")
            lines.append(f"改前: {self._truncate(h.old_value, 100)}")
            lines.append(f"改后: {self._truncate(h.new_value, 100)}")

        return "\n".join(lines)

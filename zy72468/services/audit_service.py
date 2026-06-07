from typing import Dict, Any, List, Optional
from models import AuditLog, OperationType, UserRole
from .data_repository import DataRepository


class AuditService:
    def __init__(self, repository: DataRepository):
        self.repo = repository

    def log_operation(
        self,
        operation_type: OperationType,
        operator: str,
        operator_role: UserRole,
        target_entity_type: str,
        target_entity_id: str,
        changes: Optional[Dict[str, Dict[str, Any]]] = None,
        reason: Optional[str] = None,
        impacted_results: Optional[List[str]] = None,
    ) -> AuditLog:
        log = AuditLog(
            created_by=operator,
            updated_by=operator,
            operation_type=operation_type,
            operator=operator,
            operator_role=operator_role,
            target_entity_type=target_entity_type,
            target_entity_id=target_entity_id,
            changes=changes or {},
            reason=reason,
            impacted_results=impacted_results or [],
        )
        self.repo.add_audit_log(log)
        return log

    def get_entity_history(self, entity_type: str, entity_id: str) -> List[AuditLog]:
        return self.repo.get_audit_logs_by_entity(entity_type, entity_id)

    def get_change_summary(self, entity_type: str, entity_id: str) -> List[Dict[str, Any]]:
        logs = self.get_entity_history(entity_type, entity_id)
        summary = []
        for log in logs:
            summary.append({
                "timestamp": log.timestamp,
                "operator": log.operator,
                "operator_role": log.operator_role,
                "operation": log.operation_type,
                "what_changed": list(log.changes.keys()),
                "why": log.reason,
                "impacted_results": log.impacted_results,
            })
        return summary

    def build_change_dict(
        self,
        old_obj: Optional[Any],
        new_obj: Any,
        fields: List[str]
    ) -> Dict[str, Dict[str, Any]]:
        changes = {}
        for field in fields:
            old_val = getattr(old_obj, field, None) if old_obj else None
            new_val = getattr(new_obj, field, None)
            if old_val != new_val:
                changes[field] = {"old": old_val, "new": new_val}
        return changes

from typing import Dict, Any, Optional, List
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.models import AuditLog, OperationType, ReductionApplication
from app.schemas.common import AuditLogInfo


class AuditService:
    def __init__(self, db: Session):
        self.db = db

    def log_operation(
        self,
        operation_type: str,
        operator: str,
        table_name: Optional[str] = None,
        record_id: Optional[int] = None,
        field_name: Optional[str] = None,
        old_value: Optional[str] = None,
        new_value: Optional[str] = None,
        old_values: Optional[Dict[str, Any]] = None,
        new_values: Optional[Dict[str, Any]] = None,
        change_reason: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        application_id: Optional[int] = None,
    ) -> AuditLog:
        log = AuditLog(
            operation_type=operation_type,
            operator=operator,
            table_name=table_name,
            record_id=record_id,
            field_name=field_name,
            old_value=old_value,
            new_value=new_value,
            old_values=old_values,
            new_values=new_values,
            change_reason=change_reason,
            ip_address=ip_address,
            user_agent=user_agent,
            application_id=application_id,
            created_by=operator,
            updated_by=operator,
        )
        self.db.add(log)
        self.db.flush()
        return log

    def log_field_change(
        self,
        application_id: int,
        table_name: str,
        record_id: int,
        field_name: str,
        old_value: Any,
        new_value: Any,
        operator: str,
        change_reason: Optional[str] = None,
    ) -> AuditLog:
        return self.log_operation(
            operation_type=OperationType.MANUAL_OVERRIDE.value,
            operator=operator,
            table_name=table_name,
            record_id=record_id,
            field_name=field_name,
            old_value=str(old_value) if old_value is not None else None,
            new_value=str(new_value) if new_value is not None else None,
            change_reason=change_reason or f"人工修改字段: {field_name}",
            application_id=application_id,
        )

    def log_manual_override(
        self,
        application_id: int,
        old_values: Dict[str, Any],
        new_values: Dict[str, Any],
        operator: str,
        reason: str,
    ) -> AuditLog:
        changed_fields = []
        for key in new_values:
            if key in old_values and old_values[key] != new_values[key]:
                changed_fields.append(f"{key}: {old_values[key]} -> {new_values[key]}")

        return self.log_operation(
            operation_type=OperationType.MANUAL_OVERRIDE.value,
            operator=operator,
            table_name="reduction_applications",
            record_id=application_id,
            old_values=old_values,
            new_values=new_values,
            change_reason=f"人工修改: {reason}; 变更字段: {'; '.join(changed_fields)}",
            application_id=application_id,
        )

    def get_application_audit_logs(
        self, application_id: int, skip: int = 0, limit: int = 100
    ) -> List[AuditLogInfo]:
        logs = (
            self.db.query(AuditLog)
            .filter(AuditLog.application_id == application_id)
            .order_by(desc(AuditLog.created_at))
            .offset(skip)
            .limit(limit)
            .all()
        )
        return [AuditLogInfo.model_validate(log) for log in logs]

    def get_field_modification_history(
        self, application_id: int, field_name: str
    ) -> List[Dict[str, Any]]:
        logs = (
            self.db.query(AuditLog)
            .filter(
                AuditLog.application_id == application_id,
                AuditLog.field_name == field_name,
            )
            .order_by(AuditLog.created_at)
            .all()
        )

        history = []
        for log in logs:
            history.append({
                "timestamp": log.created_at,
                "operator": log.operator,
                "old_value": log.old_value,
                "new_value": log.new_value,
                "reason": log.change_reason,
            })

        return history

    def compare_versions(
        self, application_id: int, version_1_log_id: int, version_2_log_id: int
    ) -> Dict[str, Any]:
        log1 = self.db.query(AuditLog).filter(AuditLog.id == version_1_log_id).first()
        log2 = self.db.query(AuditLog).filter(AuditLog.id == version_2_log_id).first()

        if not log1 or not log2:
            return {"error": "未找到指定的版本记录"}

        differences = []
        values1 = log1.new_values or {}
        values2 = log2.new_values or {}

        all_keys = set(values1.keys()) | set(values2.keys())

        for key in all_keys:
            v1 = values1.get(key)
            v2 = values2.get(key)
            if v1 != v2:
                differences.append({
                    "field": key,
                    "old_value": v1,
                    "new_value": v2,
                })

        return {
            "application_id": application_id,
            "version_1": {
                "log_id": version_1_log_id,
                "timestamp": log1.created_at,
                "operator": log1.operator,
            },
            "version_2": {
                "log_id": version_2_log_id,
                "timestamp": log2.created_at,
                "operator": log2.operator,
            },
            "differences": differences,
        }

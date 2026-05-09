import json
import uuid
from datetime import datetime
from typing import Any, Optional, Dict, List
from sqlalchemy.orm import Session

from inventory.models import AuditLog


class AuditService:
    def __init__(self, db_session: Session):
        self.db = db_session

    def log_action(
        self,
        action: str,
        resource_type: str,
        resource_id: Optional[str] = None,
        user_id: Optional[str] = None,
        username: Optional[str] = None,
        old_value: Any = None,
        new_value: Any = None,
        status: str = 'success',
        error_message: Optional[str] = None,
        ip_address: Optional[str] = None,
    ) -> AuditLog:
        correlation_id = str(uuid.uuid4())[:8]

        log = AuditLog(
            action=action,
            resource_type=resource_type,
            resource_id=str(resource_id) if resource_id else None,
            user_id=str(user_id) if user_id else None,
            username=username,
            ip_address=ip_address,
            timestamp=datetime.utcnow(),
            old_value=json.dumps(old_value, ensure_ascii=False, default=str) if old_value is not None else None,
            new_value=json.dumps(new_value, ensure_ascii=False, default=str) if new_value is not None else None,
            status=status,
            error_message=error_message,
            correlation_id=correlation_id,
        )

        self.db.add(log)
        return log

    def log_create(
        self,
        resource_type: str,
        new_value: Any,
        **kwargs
    ) -> AuditLog:
        return self.log_action(
            action='CREATE',
            resource_type=resource_type,
            new_value=new_value,
            **kwargs
        )

    def log_update(
        self,
        resource_type: str,
        resource_id: str,
        old_value: Any,
        new_value: Any,
        **kwargs
    ) -> AuditLog:
        return self.log_action(
            action='UPDATE',
            resource_type=resource_type,
            resource_id=resource_id,
            old_value=old_value,
            new_value=new_value,
            **kwargs
        )

    def log_delete(
        self,
        resource_type: str,
        resource_id: str,
        old_value: Any,
        **kwargs
    ) -> AuditLog:
        return self.log_action(
            action='DELETE',
            resource_type=resource_type,
            resource_id=resource_id,
            old_value=old_value,
            **kwargs
        )

    def log_error(
        self,
        action: str,
        resource_type: str,
        error_message: str,
        resource_id: Optional[str] = None,
        **kwargs
    ) -> AuditLog:
        return self.log_action(
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            status='error',
            error_message=error_message,
            **kwargs
        )

    def get_logs(
        self,
        resource_type: Optional[str] = None,
        action: Optional[str] = None,
        username: Optional[str] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[AuditLog]:
        query = self.db.query(AuditLog)

        if resource_type:
            query = query.filter(AuditLog.resource_type == resource_type)
        if action:
            query = query.filter(AuditLog.action == action)
        if username:
            query = query.filter(AuditLog.username == username)
        if start_time:
            query = query.filter(AuditLog.timestamp >= start_time)
        if end_time:
            query = query.filter(AuditLog.timestamp <= end_time)

        return query.order_by(AuditLog.timestamp.desc()).offset(offset).limit(limit).all()

    def get_logs_by_resource(self, resource_type: str, resource_id: str) -> List[AuditLog]:
        return self.db.query(AuditLog).filter(
            AuditLog.resource_type == resource_type,
            AuditLog.resource_id == str(resource_id)
        ).order_by(AuditLog.timestamp.desc()).all()

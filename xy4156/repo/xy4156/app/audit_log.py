from app import db
from app.models import AuditLog
from datetime import datetime
from typing import Optional


class AuditLogger:
    @staticmethod
    def log(action: str, resource_type: Optional[str] = None, resource_id: Optional[str] = None,
            user_name: Optional[str] = None, details: Optional[str] = None) -> None:
        log_entry = AuditLog(
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            user_name=user_name or 'system',
            details=details
        )
        db.session.add(log_entry)
        db.session.commit()
    
    @staticmethod
    def get_logs(limit: int = 100, offset: int = 0, action: Optional[str] = None,
                 resource_type: Optional[str] = None, user_name: Optional[str] = None):
        query = AuditLog.query
        
        if action:
            query = query.filter(AuditLog.action == action)
        if resource_type:
            query = query.filter(AuditLog.resource_type == resource_type)
        if user_name:
            query = query.filter(AuditLog.user_name == user_name)
        
        logs = query.order_by(AuditLog.created_at.desc()).offset(offset).limit(limit).all()
        
        return [{
            'id': log.id,
            'action': log.action,
            'resource_type': log.resource_type,
            'resource_id': log.resource_id,
            'user_name': log.user_name,
            'details': log.details,
            'created_at': log.created_at.isoformat() if log.created_at else None
        } for log in logs]

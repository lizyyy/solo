from sqlalchemy.orm import Session
from app.models.models import AuditLog
from app.schemas.schemas import AuditLogCreate
from app.utils.logging import log_audit
import json
from datetime import datetime
from enum import Enum


class CustomEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        if isinstance(obj, Enum):
            return obj.value
        return super().default(obj)


def create_audit_log(db: Session, log: AuditLogCreate, operator: str = None, ip_address: str = None):
    db_log = AuditLog(
        action=log.action,
        entity_type=log.entity_type,
        entity_id=log.entity_id,
        operator=operator or log.operator,
        ip_address=ip_address or log.ip_address,
        old_value=log.old_value,
        new_value=log.new_value,
        changes=log.changes
    )
    db.add(db_log)
    db.commit()
    db.refresh(db_log)
    
    log_audit(
        action=log.action,
        entity_type=log.entity_type,
        entity_id=log.entity_id,
        old_value=json.loads(log.old_value) if log.old_value else None,
        new_value=json.loads(log.new_value) if log.new_value else None,
        operator=operator or log.operator,
        ip_address=ip_address or log.ip_address
    )
    
    return db_log


def get_audit_logs(db: Session, skip: int = 0, limit: int = 100, entity_type: str = None):
    query = db.query(AuditLog)
    if entity_type:
        query = query.filter(AuditLog.entity_type == entity_type)
    return query.order_by(AuditLog.created_at.desc()).offset(skip).limit(limit).all()


def log_entity_change(db: Session, entity_type: str, entity_id: int,
                       old_data: dict, new_data: dict, operator: str = None,
                       ip_address: str = None, action: str = "update"):
    changes = {}
    for key in set(list(old_data.keys()) + list(new_data.keys())):
        if old_data.get(key) != new_data.get(key):
            changes[key] = {
                "old": old_data.get(key),
                "new": new_data.get(key)
            }
    
    if changes:
        log = AuditLogCreate(
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            old_value=json.dumps(old_data, ensure_ascii=False, cls=CustomEncoder),
            new_value=json.dumps(new_data, ensure_ascii=False, cls=CustomEncoder),
            changes=json.dumps(changes, ensure_ascii=False, cls=CustomEncoder)
        )
        return create_audit_log(db, log, operator=operator, ip_address=ip_address)

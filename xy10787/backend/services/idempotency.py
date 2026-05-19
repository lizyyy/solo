from sqlalchemy.orm import Session
from models import OperationLog
from datetime import datetime, timedelta
from typing import Optional


class IdempotencyService:
    IDEMPOTENCY_EXPIRE_HOURS = 24

    @classmethod
    def check_and_mark_operation(cls, db: Session, idempotency_key: str, 
                                  operation_type: str, operator: str) -> Optional[OperationLog]:
        if not idempotency_key:
            return None
        
        existing = db.query(OperationLog).filter(
            OperationLog.request_idempotency_key == idempotency_key
        ).first()
        
        if existing:
            cutoff_time = datetime.utcnow() - timedelta(hours=cls.IDEMPOTENCY_EXPIRE_HOURS)
            if existing.operation_time > cutoff_time:
                return existing
        
        return None

    @classmethod
    def create_operation_log(cls, db: Session, translation_id: Optional[int],
                             operation_type: str, operator: str,
                             old_value: Optional[str] = None, new_value: Optional[str] = None,
                             old_status: Optional[str] = None, new_status: Optional[str] = None,
                             idempotency_key: Optional[str] = None) -> OperationLog:
        log = OperationLog(
            translation_id=translation_id,
            operation_type=operation_type,
            operator=operator,
            old_value=old_value,
            new_value=new_value,
            old_status=old_status,
            new_status=new_status,
            request_idempotency_key=idempotency_key
        )
        db.add(log)
        db.commit()
        db.refresh(log)
        return log

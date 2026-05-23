from datetime import datetime
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session

from app.models.enums import OperationType
from app.models.database import AuditLog


class AuditService:
    def __init__(self, db: Session):
        self.db = db

    def log(
        self,
        operation_type: OperationType,
        operator: str,
        work_order_id: Optional[str] = None,
        batch_id: Optional[str] = None,
        before_data: Optional[Dict[str, Any]] = None,
        after_data: Optional[Dict[str, Any]] = None,
        remark: Optional[str] = None,
        ip_address: Optional[str] = None,
    ) -> AuditLog:
        log = AuditLog(
            operation_type=operation_type.value if hasattr(operation_type, 'value') else operation_type,
            operator=operator,
            operation_time=datetime.utcnow(),
            work_order_id=work_order_id,
            batch_id=batch_id,
            before_data=before_data,
            after_data=after_data,
            remark=remark,
            ip_address=ip_address,
        )
        self.db.add(log)
        self.db.commit()
        self.db.refresh(log)
        return log

    def get_work_order_history(self, work_order_id: str, skip: int = 0, limit: int = 100):
        return (
            self.db.query(AuditLog)
            .filter(AuditLog.work_order_id == work_order_id)
            .order_by(AuditLog.operation_time.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    def get_batch_history(self, batch_id: str, skip: int = 0, limit: int = 100):
        return (
            self.db.query(AuditLog)
            .filter(AuditLog.batch_id == batch_id)
            .order_by(AuditLog.operation_time.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    def get_operator_history(self, operator: str, skip: int = 0, limit: int = 100):
        return (
            self.db.query(AuditLog)
            .filter(AuditLog.operator == operator)
            .order_by(AuditLog.operation_time.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

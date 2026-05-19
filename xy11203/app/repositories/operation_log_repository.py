from typing import List, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.models import OperationLog
from app.models.enums import OperationType


class OperationLogRepository:
    def __init__(self):
        pass

    def create(self, db: Session, operation_log: OperationLog) -> OperationLog:
        db.add(operation_log)
        db.commit()
        db.refresh(operation_log)
        return operation_log

    def log_operation(
        self,
        db: Session,
        operation_type: OperationType,
        operator_id: int,
        batch_id: Optional[int] = None,
        before_data: Optional[str] = None,
        after_data: Optional[str] = None,
        change_reason: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> OperationLog:
        log = OperationLog(
            operation_type=operation_type,
            operator_id=operator_id,
            batch_id=batch_id,
            before_data=before_data,
            after_data=after_data,
            change_reason=change_reason,
            ip_address=ip_address,
            user_agent=user_agent
        )
        return self.create(db, log)

    def get_by_batch(self, db: Session, batch_id: int) -> List[OperationLog]:
        return db.query(OperationLog).filter(
            OperationLog.batch_id == batch_id
        ).order_by(OperationLog.created_at.desc()).all()

    def get_by_operator(self, db: Session, operator_id: int) -> List[OperationLog]:
        return db.query(OperationLog).filter(
            OperationLog.operator_id == operator_id
        ).order_by(OperationLog.created_at.desc()).all()

    def get_by_type(self, db: Session, operation_type: OperationType) -> List[OperationLog]:
        return db.query(OperationLog).filter(
            OperationLog.operation_type == operation_type
        ).order_by(OperationLog.created_at.desc()).all()

    def get_by_date_range(
        self,
        db: Session,
        start_date: datetime,
        end_date: datetime
    ) -> List[OperationLog]:
        return db.query(OperationLog).filter(
            OperationLog.created_at >= start_date,
            OperationLog.created_at <= end_date
        ).order_by(OperationLog.created_at.desc()).all()

    def list_all(self, db: Session, skip: int = 0, limit: int = 100) -> List[OperationLog]:
        return db.query(OperationLog).order_by(OperationLog.created_at.desc()).offset(skip).limit(limit).all()

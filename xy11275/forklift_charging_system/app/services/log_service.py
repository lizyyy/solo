from sqlalchemy.orm import Session
from app.models import OperationLog
from app.schemas import OperationLogCreate
from datetime import datetime


class LogService:
    def __init__(self, db: Session):
        self.db = db

    def create_log(self, log_data: OperationLogCreate) -> OperationLog:
        db_log = OperationLog(**log_data.dict())
        self.db.add(db_log)
        self.db.commit()
        self.db.refresh(db_log)
        return db_log

    def log_task_operation(
        self,
        operation_type: str,
        operator: str,
        task_id: int,
        status: str,
        reason: str = None,
        details: str = None
    ) -> OperationLog:
        log_data = OperationLogCreate(
            operation_type=operation_type,
            operator=operator,
            target_id=task_id,
            target_type="charging_task",
            status=status,
            reason=reason,
            details=details
        )
        return self.create_log(log_data)

    def get_logs(
        self,
        operator: str = None,
        status: str = None,
        operation_type: str = None,
        start_time: datetime = None,
        end_time: datetime = None,
        skip: int = 0,
        limit: int = 100
    ):
        query = self.db.query(OperationLog)
        
        if operator:
            query = query.filter(OperationLog.operator == operator)
        if status:
            query = query.filter(OperationLog.status == status)
        if operation_type:
            query = query.filter(OperationLog.operation_type == operation_type)
        if start_time:
            query = query.filter(OperationLog.created_at >= start_time)
        if end_time:
            query = query.filter(OperationLog.created_at <= end_time)
        
        return query.order_by(OperationLog.created_at.desc()).offset(skip).limit(limit).all()

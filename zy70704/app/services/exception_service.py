from typing import List, Optional
from sqlalchemy.orm import Session
from app.models import ExceptionLog
from app.schemas import ExceptionLogCreate
from datetime import datetime


class ExceptionService:
    def __init__(self, db: Session):
        self.db = db

    def log_exception(
        self,
        operation: str,
        original_input: Optional[str] = None,
        error_message: Optional[str] = None,
        batch_id: Optional[int] = None,
    ) -> ExceptionLog:
        db_log = ExceptionLog(
            batch_id=batch_id,
            operation=operation,
            original_input=original_input,
            error_message=error_message,
        )
        self.db.add(db_log)
        self.db.commit()
        self.db.refresh(db_log)
        return db_log

    def handle_exception(
        self,
        log_id: int,
        handler: str,
        conclusion: str,
    ) -> Optional[ExceptionLog]:
        db_log = self.get_exception_log(log_id)
        if not db_log:
            return None

        db_log.handler = handler
        db_log.conclusion = conclusion
        db_log.handled_at = datetime.utcnow()

        self.db.commit()
        self.db.refresh(db_log)
        return db_log

    def get_exception_log(self, log_id: int) -> Optional[ExceptionLog]:
        return self.db.query(ExceptionLog).filter(ExceptionLog.id == log_id).first()

    def list_exception_logs(
        self,
        batch_id: Optional[int] = None,
        handled: Optional[bool] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> List[ExceptionLog]:
        query = self.db.query(ExceptionLog)
        if batch_id is not None:
            query = query.filter(ExceptionLog.batch_id == batch_id)
        if handled is not None:
            if handled:
                query = query.filter(ExceptionLog.handled_at.isnot(None))
            else:
                query = query.filter(ExceptionLog.handled_at.is_(None))
        return query.order_by(ExceptionLog.created_at.desc()).offset(skip).limit(limit).all()

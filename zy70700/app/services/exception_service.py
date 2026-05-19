from typing import List, Optional
from datetime import datetime
from sqlalchemy.orm import Session

from app.models import (
    ExceptionRecord,
    ExceptionStatus,
)
from app.schemas import (
    ExceptionRecordCreate,
    ExceptionRecordUpdate,
)


class ExceptionService:
    @staticmethod
    def create_exception(db: Session, exception: ExceptionRecordCreate) -> ExceptionRecord:
        db_exception = ExceptionRecord(**exception.model_dump())
        db.add(db_exception)
        db.commit()
        db.refresh(db_exception)
        return db_exception

    @staticmethod
    def get_exception(db: Session, exception_id: int) -> Optional[ExceptionRecord]:
        return db.query(ExceptionRecord).filter(ExceptionRecord.id == exception_id).first()

    @staticmethod
    def get_exceptions_by_batch(db: Session, batch_id: int) -> List[ExceptionRecord]:
        return db.query(ExceptionRecord).filter(ExceptionRecord.batch_id == batch_id).all()

    @staticmethod
    def get_exceptions_by_tool(db: Session, tool_id: int) -> List[ExceptionRecord]:
        return db.query(ExceptionRecord).filter(ExceptionRecord.tool_id == tool_id).all()

    @staticmethod
    def get_all_exceptions(
        db: Session, status: Optional[ExceptionStatus] = None
    ) -> List[ExceptionRecord]:
        query = db.query(ExceptionRecord)
        if status:
            query = query.filter(ExceptionRecord.status == status)
        return query.order_by(ExceptionRecord.created_at.desc()).all()

    @staticmethod
    def update_exception(
        db: Session, exception_id: int, exception_update: ExceptionRecordUpdate
    ) -> Optional[ExceptionRecord]:
        db_exception = ExceptionService.get_exception(db, exception_id)
        if not db_exception:
            return None
        update_data = exception_update.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_exception, key, value)
        db_exception.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(db_exception)
        return db_exception

    @staticmethod
    def review_exception(
        db: Session,
        exception_id: int,
        status: ExceptionStatus,
        handler: str,
        handling_conclusion: str,
        handling_notes: Optional[str] = None,
    ) -> Optional[ExceptionRecord]:
        db_exception = ExceptionService.get_exception(db, exception_id)
        if not db_exception:
            return None
        
        db_exception.status = status
        db_exception.handler = handler
        db_exception.handling_time = datetime.utcnow()
        db_exception.handling_conclusion = handling_conclusion
        db_exception.handling_notes = handling_notes
        db_exception.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(db_exception)
        return db_exception

    @staticmethod
    def resolve_exception(
        db: Session,
        exception_id: int,
        handler: str,
        handling_conclusion: str,
        handling_notes: Optional[str] = None,
    ) -> Optional[ExceptionRecord]:
        return ExceptionService.review_exception(
            db,
            exception_id,
            ExceptionStatus.RESOLVED,
            handler,
            handling_conclusion,
            handling_notes,
        )

    @staticmethod
    def dismiss_exception(
        db: Session,
        exception_id: int,
        handler: str,
        handling_conclusion: str,
        handling_notes: Optional[str] = None,
    ) -> Optional[ExceptionRecord]:
        return ExceptionService.review_exception(
            db,
            exception_id,
            ExceptionStatus.DISMISSED,
            handler,
            handling_conclusion,
            handling_notes,
        )

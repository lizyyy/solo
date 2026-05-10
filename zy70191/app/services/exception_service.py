from typing import List, Optional
from datetime import datetime
from sqlalchemy.orm import Session

from app.models import ExceptionRecord, ExceptionType
from app.schemas import ExceptionRecordCreate


class ExceptionService:
    def __init__(self, db: Session):
        self.db = db

    def record_exception(
        self,
        exception_type: ExceptionType,
        description: str,
        detail: Optional[str] = None,
        switch_request_id: Optional[int] = None
    ) -> ExceptionRecord:
        exception = ExceptionRecord(
            switch_request_id=switch_request_id,
            exception_type=exception_type,
            description=description,
            detail=detail
        )
        self.db.add(exception)
        self.db.commit()
        self.db.refresh(exception)
        return exception

    def get_exception(self, exception_id: int) -> Optional[ExceptionRecord]:
        return self.db.query(ExceptionRecord).filter(ExceptionRecord.id == exception_id).first()

    def get_all_exceptions(
        self,
        is_resolved: Optional[bool] = None,
        exception_type: Optional[ExceptionType] = None
    ) -> List[ExceptionRecord]:
        query = self.db.query(ExceptionRecord)
        
        if is_resolved is not None:
            query = query.filter(ExceptionRecord.is_resolved == is_resolved)
        if exception_type:
            query = query.filter(ExceptionRecord.exception_type == exception_type)
        
        return query.order_by(ExceptionRecord.created_at.desc()).all()

    def get_pending_exceptions(self) -> List[ExceptionRecord]:
        return self.get_all_exceptions(is_resolved=False)

    def resolve_exception(
        self,
        exception_id: int,
        resolved_by: str,
        resolution_detail: Optional[str] = None
    ) -> Optional[ExceptionRecord]:
        exception = self.get_exception(exception_id)
        if exception:
            exception.is_resolved = True
            exception.resolved_by = resolved_by
            exception.resolved_at = datetime.utcnow()
            if resolution_detail:
                if exception.detail:
                    exception.detail = f"{exception.detail}\n\n处理说明: {resolution_detail}"
                else:
                    exception.detail = f"处理说明: {resolution_detail}"
            self.db.commit()
            self.db.refresh(exception)
        return exception

    def get_exceptions_by_request(self, switch_request_id: int) -> List[ExceptionRecord]:
        return self.db.query(ExceptionRecord).filter(
            ExceptionRecord.switch_request_id == switch_request_id
        ).order_by(ExceptionRecord.created_at.desc()).all()

    def get_exception_statistics(self) -> dict:
        total = self.db.query(ExceptionRecord).count()
        pending = self.db.query(ExceptionRecord).filter(ExceptionRecord.is_resolved == False).count()
        resolved = total - pending
        
        by_type = {}
        for et in ExceptionType:
            count = self.db.query(ExceptionRecord).filter(
                ExceptionRecord.exception_type == et
            ).count()
            by_type[et.value] = count

        return {
            "total": total,
            "pending": pending,
            "resolved": resolved,
            "by_type": by_type
        }

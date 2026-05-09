from datetime import datetime
from typing import Optional, List
from sqlalchemy.orm import Session
from ..models import (
    BorrowApplication, StatusHistory, ApplicationStatus, TimeoutLevel,
    StatusCorrectionType
)


class StatusService:
    @staticmethod
    def record_status_change(
        db: Session,
        application: BorrowApplication,
        new_status: Optional[ApplicationStatus] = None,
        new_timeout_level: Optional[TimeoutLevel] = None,
        operator: str = "system",
        reason: Optional[str] = None,
        correction_type: StatusCorrectionType = StatusCorrectionType.NORMAL_FLOW,
        affected_fields: Optional[List[str]] = None,
        previous_values: Optional[dict] = None,
        new_values: Optional[dict] = None
    ) -> StatusHistory:
        previous_status = application.status
        previous_timeout = application.current_timeout_level
        
        actual_new_status = new_status if new_status is not None else previous_status
        actual_new_timeout = new_timeout_level if new_timeout_level is not None else previous_timeout
        
        status_changed = (previous_status != actual_new_status)
        timeout_changed = (previous_timeout != actual_new_timeout)
        
        if not status_changed and not timeout_changed:
            return None
        
        history = StatusHistory(
            application_id=application.id,
            previous_status=previous_status,
            new_status=actual_new_status,
            previous_timeout_level=previous_timeout,
            new_timeout_level=actual_new_timeout,
            correction_type=correction_type,
            operator=operator,
            operation_reason=reason,
            operation_time=datetime.now(),
            affected_fields=affected_fields or [],
            previous_values=previous_values or {},
            new_values=new_values or {}
        )
        
        db.add(history)
        db.flush()
        
        if new_status is not None:
            application.status = new_status
        
        if new_timeout_level is not None:
            application.current_timeout_level = new_timeout_level
        
        application.updated_at = datetime.now()
        
        return history

    @staticmethod
    def get_application_history(
        db: Session,
        application_id: int
    ) -> List[StatusHistory]:
        return db.query(StatusHistory).filter(
            StatusHistory.application_id == application_id
        ).order_by(StatusHistory.operation_time.desc()).all()

    @staticmethod
    def get_status_at_time(
        db: Session,
        application_id: int,
        target_time: datetime
    ) -> dict:
        histories = db.query(StatusHistory).filter(
            StatusHistory.application_id == application_id,
            StatusHistory.operation_time <= target_time
        ).order_by(StatusHistory.operation_time.desc()).all()
        
        if not histories:
            application = db.query(BorrowApplication).filter(
                BorrowApplication.id == application_id
            ).first()
            if application:
                return {
                    "status": application.status,
                    "timeout_level": application.current_timeout_level,
                    "is_manual_correction": False
                }
            return None
        
        latest = histories[0]
        
        return {
            "status": latest.new_status,
            "timeout_level": latest.new_timeout_level,
            "is_manual_correction": latest.correction_type == StatusCorrectionType.MANUAL_CORRECTION,
            "operator": latest.operator,
            "operation_time": latest.operation_time
        }

    @staticmethod
    def has_manual_correction(
        db: Session,
        application_id: int
    ) -> bool:
        return db.query(StatusHistory).filter(
            StatusHistory.application_id == application_id,
            StatusHistory.correction_type == StatusCorrectionType.MANUAL_CORRECTION
        ).count() > 0

    @staticmethod
    def get_manual_correction_records(
        db: Session,
        application_id: int
    ) -> List[StatusHistory]:
        return db.query(StatusHistory).filter(
            StatusHistory.application_id == application_id,
            StatusHistory.correction_type == StatusCorrectionType.MANUAL_CORRECTION
        ).order_by(StatusHistory.operation_time.desc()).all()

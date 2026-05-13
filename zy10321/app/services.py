from datetime import datetime
from typing import List, Optional, Tuple
from sqlalchemy.orm import Session
from app.models import (
    ServiceGroup, FreezeCalendar, ChangeOrder, ExceptionRequest,
    Approver, BlockLog, FreezeStatus, ChangeStatus, ExceptionStatus
)
from app import schemas


class FreezeCalendarService:
    @staticmethod
    def match_freezes(db: Session, service_group_id: int, planned_time: datetime) -> List[FreezeCalendar]:
        return db.query(FreezeCalendar).filter(
            FreezeCalendar.service_group_id == service_group_id,
            FreezeCalendar.status == FreezeStatus.ACTIVE,
            FreezeCalendar.start_time <= planned_time,
            FreezeCalendar.end_time >= planned_time
        ).all()

    @staticmethod
    def check_emergency_exception(db: Session, change_id: int) -> bool:
        return db.query(ExceptionRequest).filter(
            ExceptionRequest.change_id == change_id,
            ExceptionRequest.is_emergency == True,
            ExceptionRequest.status == ExceptionStatus.APPROVED
        ).first() is not None

    @staticmethod
    def check_regular_exception(db: Session, change_id: int, freeze_id: int) -> bool:
        return db.query(ExceptionRequest).filter(
            ExceptionRequest.change_id == change_id,
            ExceptionRequest.freeze_id == freeze_id,
            ExceptionRequest.status == ExceptionStatus.APPROVED
        ).first() is not None

    @staticmethod
    def validate_change(db: Session, change: ChangeOrder) -> schemas.ValidationResult:
        matched_freezes = FreezeCalendarService.match_freezes(
            db, change.service_group_id, change.planned_time
        )

        if not matched_freezes:
            return schemas.ValidationResult(
                allowed=True,
                status=ChangeStatus.APPROVED,
                message="No active freeze periods match this change",
                matched_freezes=[],
                block_log_id=None
            )

        if FreezeCalendarService.check_emergency_exception(db, change.id):
            return schemas.ValidationResult(
                allowed=True,
                status=ChangeStatus.EMERGENCY,
                message="Change allowed via emergency exception approval",
                matched_freezes=matched_freezes,
                block_log_id=None
            )

        block_freezes = []
        for freeze in matched_freezes:
            if not FreezeCalendarService.check_regular_exception(db, change.id, freeze.id):
                block_freezes.append(freeze)

        if not block_freezes:
            return schemas.ValidationResult(
                allowed=True,
                status=ChangeStatus.EXCEPTION,
                message="Change allowed via exception approval for all freezes",
                matched_freezes=matched_freezes,
                block_log_id=None
            )

        block_log_ids = []
        for freeze in block_freezes:
            existing_log = db.query(BlockLog).filter(
                BlockLog.change_id == change.id,
                BlockLog.freeze_id == freeze.id
            ).first()

            if not existing_log:
                block_log = BlockLog(
                    change_id=change.id,
                    freeze_id=freeze.id,
                    reason=f"Change blocked by freeze period: {freeze.name}"
                )
                db.add(block_log)
                db.commit()
                db.refresh(block_log)
                block_log_ids.append(block_log.id)
            else:
                block_log_ids.append(existing_log.id)

        change.status = ChangeStatus.BLOCKED
        db.commit()

        return schemas.ValidationResult(
            allowed=False,
            status=ChangeStatus.BLOCKED,
            message=f"Change blocked by {len(block_freezes)} active freeze period(s). Apply for exception to proceed.",
            matched_freezes=matched_freezes,
            block_log_id=block_log_ids[0] if block_log_ids else None
        )


class ChangeOrderService:
    @staticmethod
    def get_by_idempotency_key(db: Session, key: str) -> Optional[ChangeOrder]:
        return db.query(ChangeOrder).filter(ChangeOrder.idempotency_key == key).first() if key else None

    @staticmethod
    def create_change(db: Session, change_data: schemas.ChangeOrderCreate) -> Tuple[ChangeOrder, bool]:
        if change_data.idempotency_key:
            existing = ChangeOrderService.get_by_idempotency_key(db, change_data.idempotency_key)
            if existing:
                return existing, False

        db_change = ChangeOrder(**change_data.model_dump())
        db.add(db_change)
        db.commit()
        db.refresh(db_change)
        return db_change, True


class ExceptionService:
    @staticmethod
    def approve_exception(
        db: Session,
        exception_id: int,
        approver: str,
        status: ExceptionStatus
    ) -> Optional[ExceptionRequest]:
        exception = db.query(ExceptionRequest).filter(ExceptionRequest.id == exception_id).first()
        if not exception:
            return None

        exception.approver = approver
        exception.status = status
        if status == ExceptionStatus.APPROVED:
            exception.approved_at = datetime.utcnow()

        db.commit()
        db.refresh(exception)
        return exception


class BlockLogService:
    @staticmethod
    def resolve_log(
        db: Session,
        log_id: int,
        resolved_by: str
    ) -> Optional[BlockLog]:
        log = db.query(BlockLog).filter(BlockLog.id == log_id).first()
        if not log:
            return None

        log.resolved = True
        log.resolved_by = resolved_by
        log.resolved_at = datetime.utcnow()
        db.commit()
        db.refresh(log)
        return log

    @staticmethod
    def export_logs(
        db: Session,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        service_group_id: Optional[int] = None
    ) -> List[BlockLog]:
        query = db.query(BlockLog)
        if start_time:
            query = query.filter(BlockLog.block_time >= start_time)
        if end_time:
            query = query.filter(BlockLog.block_time <= end_time)
        if service_group_id:
            query = query.join(ChangeOrder).filter(ChangeOrder.service_group_id == service_group_id)
        return query.all()

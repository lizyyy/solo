from sqlalchemy.orm import Session
from typing import Optional, List, Tuple
import json

from app.models import AcceptanceRecord, StatusLog, Attachment, FailedRecord, User
from app.models.audit import RecordStatus, SourceType
from app.schemas import AcceptanceRecordCreate, AcceptanceRecordUpdate, RecordQuery
from app.core.config import settings


class AuditService:
    @staticmethod
    def create_record(db: Session, record_in: AcceptanceRecordCreate, user_id: int) -> AcceptanceRecord:
        db_record = AcceptanceRecord(
            **record_in.model_dump(),
            created_by=user_id,
            status=RecordStatus.DRAFT
        )
        db.add(db_record)
        db.flush()

        status_log = StatusLog(
            record_id=db_record.id,
            from_status=None,
            to_status=RecordStatus.DRAFT,
            operator_id=user_id,
            reason="创建验收记录"
        )
        db.add(status_log)
        db.commit()
        db.refresh(db_record)
        return db_record

    @staticmethod
    def get_record(db: Session, record_id: int) -> Optional[AcceptanceRecord]:
        return db.query(AcceptanceRecord).filter(AcceptanceRecord.id == record_id).first()

    @staticmethod
    def get_record_by_no(db: Session, record_no: str) -> Optional[AcceptanceRecord]:
        return db.query(AcceptanceRecord).filter(AcceptanceRecord.record_no == record_no).first()

    @staticmethod
    def update_record(db: Session, record_id: int, record_in: AcceptanceRecordUpdate, user_id: int) -> Optional[AcceptanceRecord]:
        db_record = AuditService.get_record(db, record_id)
        if not db_record:
            return None

        update_data = record_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_record, field, value)

        db.commit()
        db.refresh(db_record)
        return db_record

    @staticmethod
    def change_status(db: Session, record_id: int, new_status: RecordStatus, reason: str, operator_id: int) -> Optional[AcceptanceRecord]:
        db_record = AuditService.get_record(db, record_id)
        if not db_record:
            return None

        old_status = db_record.status
        db_record.status = new_status

        status_log = StatusLog(
            record_id=db_record.id,
            from_status=old_status,
            to_status=new_status,
            operator_id=operator_id,
            reason=reason
        )
        db.add(status_log)
        db.commit()
        db.refresh(db_record)
        return db_record

    @staticmethod
    def list_records(
        db: Session,
        query: RecordQuery,
        skip: int = 0,
        limit: int = 100
    ) -> Tuple[List[AcceptanceRecord], int]:
        db_query = db.query(AcceptanceRecord)

        if query.pharmacy_name:
            db_query = db_query.filter(AcceptanceRecord.pharmacy_name.contains(query.pharmacy_name))
        if query.pharmacy_region:
            db_query = db_query.filter(AcceptanceRecord.pharmacy_region == query.pharmacy_region)
        if query.source_type:
            db_query = db_query.filter(AcceptanceRecord.source_type == query.source_type)
        if query.status:
            db_query = db_query.filter(AcceptanceRecord.status == query.status)
        if query.medicine_name:
            db_query = db_query.filter(AcceptanceRecord.medicine_name.contains(query.medicine_name))
        if query.batch_no:
            db_query = db_query.filter(AcceptanceRecord.batch_no.contains(query.batch_no))
        if query.is_bad_data is not None:
            db_query = db_query.filter(AcceptanceRecord.is_bad_data == query.is_bad_data)
        if query.start_date:
            db_query = db_query.filter(AcceptanceRecord.created_at >= query.start_date)
        if query.end_date:
            db_query = db_query.filter(AcceptanceRecord.created_at <= query.end_date)

        total = db_query.count()
        records = db_query.order_by(AcceptanceRecord.created_at.desc()).offset(skip).limit(limit).all()
        return records, total

    @staticmethod
    def add_attachment(db: Session, record_id: int, file_name: str, file_path: str,
                       file_type: str, file_size: int, user_id: int, description: str = None) -> Attachment:
        attachment = Attachment(
            record_id=record_id,
            file_name=file_name,
            file_path=file_path,
            file_type=file_type,
            file_size=file_size,
            uploaded_by=user_id,
            description=description
        )
        db.add(attachment)
        db.commit()
        db.refresh(attachment)
        return attachment

    @staticmethod
    def mark_as_bad_data(db: Session, record_id: int, error_type: str, error_message: str,
                         error_details: dict = None, raw_data: dict = None) -> Optional[AcceptanceRecord]:
        db_record = AuditService.get_record(db, record_id)
        if not db_record:
            return None

        db_record.is_bad_data = True
        db_record.is_valid = False
        db_record.status = RecordStatus.FAILED

        failed_record = FailedRecord(
            record_id=db_record.id,
            record_no=db_record.record_no,
            error_type=error_type,
            error_message=error_message,
            error_details=json.dumps(error_details) if error_details else None,
            raw_data=json.dumps(raw_data) if raw_data else None,
            resolved=False
        )
        db.add(failed_record)
        db.commit()
        db.refresh(db_record)
        return db_record

    @staticmethod
    def list_failed_records(db: Session, resolved: bool = None, skip: int = 0, limit: int = 100) -> Tuple[List[FailedRecord], int]:
        query = db.query(FailedRecord)
        if resolved is not None:
            query = query.filter(FailedRecord.resolved == resolved)

        total = query.count()
        records = query.order_by(FailedRecord.failed_at.desc()).offset(skip).limit(limit).all()
        return records, total

    @staticmethod
    def resolve_failed_record(db: Session, failed_id: int, resolution_notes: str,
                              resolved_by: int, new_status: RecordStatus = RecordStatus.MANUALLY_RESOLVED) -> Optional[FailedRecord]:
        failed = db.query(FailedRecord).filter(FailedRecord.id == failed_id).first()
        if not failed:
            return None

        from datetime import datetime
        failed.resolved = True
        failed.resolved_by = resolved_by
        failed.resolved_at = datetime.now()
        failed.resolution_notes = resolution_notes

        record = AuditService.get_record(db, failed.record_id)
        if record:
            record.is_bad_data = False
            record.is_valid = True
            record.status = new_status

            status_log = StatusLog(
                record_id=record.id,
                from_status=RecordStatus.FAILED,
                to_status=new_status,
                operator_id=resolved_by,
                reason=f"人工修复: {resolution_notes}"
            )
            db.add(status_log)

        db.commit()
        db.refresh(failed)
        return failed

    @staticmethod
    def enhance_record_with_user_info(record: AcceptanceRecord, db: Session) -> AcceptanceRecord:
        if record.created_by:
            creator = db.query(User).filter(User.id == record.created_by).first()
            if creator:
                record.created_by_name = creator.full_name

        for log in record.status_logs:
            operator = db.query(User).filter(User.id == log.operator_id).first()
            if operator:
                log.operator_name = operator.full_name

        return record

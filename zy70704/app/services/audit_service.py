from typing import List, Optional
from sqlalchemy.orm import Session
from app.models import AuditRecord
from app.schemas import AuditRecordCreate
from app.models.models import BatchStatus
from datetime import datetime


class AuditService:
    def __init__(self, db: Session):
        self.db = db

    def create_audit_record(
        self,
        batch_id: int,
        from_status: Optional[BatchStatus],
        to_status: BatchStatus,
        operator: str,
        comment: Optional[str] = None,
    ) -> AuditRecord:
        db_audit = AuditRecord(
            batch_id=batch_id,
            from_status=from_status,
            to_status=to_status,
            operator=operator,
            comment=comment,
        )
        self.db.add(db_audit)
        self.db.commit()
        self.db.refresh(db_audit)
        return db_audit

    def get_audit_record(self, audit_id: int) -> Optional[AuditRecord]:
        return self.db.query(AuditRecord).filter(AuditRecord.id == audit_id).first()

    def list_audit_records(
        self, batch_id: Optional[int] = None, skip: int = 0, limit: int = 100
    ) -> List[AuditRecord]:
        query = self.db.query(AuditRecord)
        if batch_id:
            query = query.filter(AuditRecord.batch_id == batch_id)
        return query.order_by(AuditRecord.audit_time.desc()).offset(skip).limit(limit).all()

from typing import List, Optional
from sqlalchemy.orm import Session
from app.models import GrayBatch
from app.schemas import GrayBatchCreate, GrayBatchUpdate
from app.services.validation_service import ValidationService
from app.models.models import BatchStatus


class BatchService:
    def __init__(self, db: Session):
        self.db = db

    def create_batch(self, batch_data: GrayBatchCreate) -> GrayBatch:
        existing = self.db.query(GrayBatch).filter(
            GrayBatch.batch_code == batch_data.batch_code
        ).first()
        if existing:
            raise ValueError(f"批次编码 {batch_data.batch_code} 已存在")

        db_batch = GrayBatch(**batch_data.model_dump())
        self.db.add(db_batch)
        self.db.commit()
        self.db.refresh(db_batch)
        return db_batch

    def get_batch(self, batch_id: int) -> Optional[GrayBatch]:
        return self.db.query(GrayBatch).filter(GrayBatch.id == batch_id).first()

    def get_batch_by_code(self, batch_code: str) -> Optional[GrayBatch]:
        return self.db.query(GrayBatch).filter(GrayBatch.batch_code == batch_code).first()

    def list_batches(
        self, skip: int = 0, limit: int = 100, status: Optional[BatchStatus] = None
    ) -> List[GrayBatch]:
        query = self.db.query(GrayBatch)
        if status:
            query = query.filter(GrayBatch.status == status)
        return query.offset(skip).limit(limit).all()

    def update_batch(
        self, batch_id: int, update_data: GrayBatchUpdate
    ) -> Optional[GrayBatch]:
        db_batch = self.get_batch(batch_id)
        if not db_batch:
            return None

        update_dict = update_data.model_dump(exclude_unset=True)
        for key, value in update_dict.items():
            setattr(db_batch, key, value)

        self.db.commit()
        self.db.refresh(db_batch)
        return db_batch

    def transition_status(
        self,
        batch_id: int,
        target_status: BatchStatus,
        operator: str,
        comment: Optional[str] = None,
    ) -> Optional[GrayBatch]:
        from app.services.audit_service import AuditService

        db_batch = self.get_batch(batch_id)
        if not db_batch:
            return None

        from_status = db_batch.status

        valid, msg = ValidationService.validate_status_transition(
            from_status, target_status
        )
        if not valid:
            raise ValueError(msg)

        db_batch.status = target_status

        audit_service = AuditService(self.db)
        audit_service.create_audit_record(
            batch_id=batch_id,
            from_status=from_status,
            to_status=target_status,
            operator=operator,
            comment=comment,
        )

        self.db.commit()
        self.db.refresh(db_batch)
        return db_batch

    def cancel_batch(
        self, batch_id: int, operator: str, reason: Optional[str] = None
    ) -> Optional[GrayBatch]:
        return self.transition_status(
            batch_id, BatchStatus.CANCELLED, operator, reason
        )

    def rollback_batch(
        self, batch_id: int, operator: str, reason: Optional[str] = None
    ) -> Optional[GrayBatch]:
        return self.transition_status(
            batch_id, BatchStatus.ROLLBACKED, operator, reason
        )

    def delete_batch(self, batch_id: int) -> bool:
        db_batch = self.get_batch(batch_id)
        if not db_batch:
            return False
        self.db.delete(db_batch)
        self.db.commit()
        return True

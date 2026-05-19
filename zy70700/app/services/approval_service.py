from typing import List, Optional
from datetime import datetime
from sqlalchemy.orm import Session

from app.models import (
    ApprovalBatch,
    PermissionDeclaration,
    ApprovalStatus,
)
from app.schemas import (
    ApprovalBatchCreate,
    ApprovalBatchUpdate,
)


class ApprovalService:
    @staticmethod
    def create_batch(db: Session, batch: ApprovalBatchCreate) -> ApprovalBatch:
        existing = db.query(ApprovalBatch).filter(
            ApprovalBatch.batch_number == batch.batch_number
        ).first()
        if existing:
            return existing
        
        db_batch = ApprovalBatch(**batch.model_dump())
        db.add(db_batch)
        db.commit()
        db.refresh(db_batch)
        return db_batch

    @staticmethod
    def get_batch(db: Session, batch_id: int) -> Optional[ApprovalBatch]:
        return db.query(ApprovalBatch).filter(ApprovalBatch.id == batch_id).first()

    @staticmethod
    def get_batch_by_number(db: Session, batch_number: str) -> Optional[ApprovalBatch]:
        return db.query(ApprovalBatch).filter(ApprovalBatch.batch_number == batch_number).first()

    @staticmethod
    def get_all_batches(db: Session, status: Optional[ApprovalStatus] = None) -> List[ApprovalBatch]:
        query = db.query(ApprovalBatch)
        if status:
            query = query.filter(ApprovalBatch.status == status)
        return query.order_by(ApprovalBatch.created_at.desc()).all()

    @staticmethod
    def update_batch(
        db: Session, batch_id: int, batch_update: ApprovalBatchUpdate
    ) -> Optional[ApprovalBatch]:
        db_batch = ApprovalService.get_batch(db, batch_id)
        if not db_batch:
            return None
        update_data = batch_update.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_batch, key, value)
        db_batch.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(db_batch)
        return db_batch

    @staticmethod
    def approve_batch(
        db: Session, batch_number: str, approver: str, notes: Optional[str] = None
    ) -> Optional[ApprovalBatch]:
        db_batch = ApprovalService.get_batch_by_number(db, batch_number)
        if not db_batch:
            return None
        
        if db_batch.status == ApprovalStatus.APPROVED:
            return db_batch
        
        db_batch.status = ApprovalStatus.APPROVED
        db_batch.approver = approver
        db_batch.approval_time = datetime.utcnow()
        db_batch.approval_notes = notes
        db_batch.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(db_batch)
        return db_batch

    @staticmethod
    def reject_batch(
        db: Session, batch_id: int, operator: str, notes: Optional[str] = None
    ) -> Optional[ApprovalBatch]:
        db_batch = ApprovalService.get_batch(db, batch_id)
        if not db_batch:
            return None
        
        db_batch.status = ApprovalStatus.REJECTED
        db_batch.approver = operator
        db_batch.approval_time = datetime.utcnow()
        db_batch.approval_notes = notes
        db_batch.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(db_batch)
        return db_batch

    @staticmethod
    def revoke_batch(
        db: Session, batch_id: int, operator: str, notes: Optional[str] = None
    ) -> Optional[ApprovalBatch]:
        db_batch = ApprovalService.get_batch(db, batch_id)
        if not db_batch:
            return None
        
        db_batch.status = ApprovalStatus.REVOKED
        db_batch.approver = operator
        db_batch.approval_time = datetime.utcnow()
        db_batch.approval_notes = notes
        db_batch.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(db_batch)
        return db_batch

    @staticmethod
    def close_batch(
        db: Session, batch_id: int, operator: str, notes: Optional[str] = None
    ) -> Optional[ApprovalBatch]:
        db_batch = ApprovalService.get_batch(db, batch_id)
        if not db_batch:
            return None
        
        db_batch.status = ApprovalStatus.CLOSED
        db_batch.approver = operator
        db_batch.approval_time = datetime.utcnow()
        db_batch.approval_notes = notes
        db_batch.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(db_batch)
        return db_batch

    @staticmethod
    def add_declaration_to_batch(
        db: Session, batch_id: int, declaration_id: int
    ) -> Optional[PermissionDeclaration]:
        db_batch = ApprovalService.get_batch(db, batch_id)
        if not db_batch:
            return None
        
        declaration = db.query(PermissionDeclaration).filter(
            PermissionDeclaration.id == declaration_id
        ).first()
        if not declaration:
            return None
        
        declaration.batch_id = batch_id
        declaration.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(declaration)
        return declaration

    @staticmethod
    def get_batch_declarations(db: Session, batch_id: int) -> List[PermissionDeclaration]:
        return db.query(PermissionDeclaration).filter(
            PermissionDeclaration.batch_id == batch_id
        ).all()

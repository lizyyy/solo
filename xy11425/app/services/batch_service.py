from typing import Optional, List, Tuple, Dict, Any
from datetime import datetime
import uuid
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..models import (
    Batch,
    BatchStatus,
    IdempotencyStrategy,
    Material,
    VisitorRecord,
    StateChange,
    AuditLog,
)
from ..schemas import BatchCreate, BatchUpdate
from .state_machine import VisitorStateMachine, StateTransitionError


class BatchService:
    @staticmethod
    def generate_batch_number() -> str:
        date_str = datetime.now().strftime("%Y%m%d")
        random_str = str(uuid.uuid4())[:8].upper()
        return f"VF-{date_str}-{random_str}"

    @staticmethod
    def check_idempotency(
        db: Session,
        idempotency_key: Optional[str],
    ) -> Tuple[Optional[Batch], Optional[str]]:
        if not idempotency_key:
            return None, None

        existing = (
            db.query(Batch)
            .filter(
                Batch.idempotency_key == idempotency_key,
                Batch.is_deleted == False,
            )
            .first()
        )

        if existing:
            strategy = existing.idempotency_strategy
            return existing, strategy

        return None, None

    @staticmethod
    def create_batch(
        db: Session,
        batch_data: BatchCreate,
    ) -> Tuple[Batch, str]:
        if batch_data.idempotency_key:
            existing_batch, strategy = BatchService.check_idempotency(
                db, batch_data.idempotency_key
            )
            if existing_batch:
                if strategy == IdempotencyStrategy.IGNORE:
                    return existing_batch, "ignored"
                elif strategy == IdempotencyStrategy.OVERWRITE:
                    return BatchService._overwrite_batch(
                        db, existing_batch, batch_data
                    ), "overwritten"
                elif strategy == IdempotencyStrategy.APPEND:
                    return existing_batch, "appended"

        batch_number = BatchService.generate_batch_number()
        
        batch = Batch(
            batch_number=batch_number,
            name=batch_data.name,
            description=batch_data.description,
            status=BatchStatus.CREATED,
            idempotency_key=batch_data.idempotency_key,
            idempotency_strategy=batch_data.idempotency_strategy,
            created_by=batch_data.created_by,
            extra_metadata=batch_data.metadata or {},
        )
        db.add(batch)
        db.commit()
        db.refresh(batch)

        state_change = StateChange(
            batch_id=batch.id,
            from_status=None,
            to_status=BatchStatus.CREATED.value,
            changed_by=batch_data.created_by,
            reason="批次创建",
            metadata={},
        )
        db.add(state_change)
        db.commit()

        return batch, "created"

    @staticmethod
    def _overwrite_batch(
        db: Session,
        batch: Batch,
        batch_data: BatchCreate,
    ) -> Batch:
        db.query(Material).filter(Material.batch_id == batch.id).delete()
        db.query(VisitorRecord).filter(VisitorRecord.batch_id == batch.id).delete()

        batch.name = batch_data.name
        batch.description = batch_data.description
        batch.updated_at = datetime.utcnow()

        db.commit()
        db.refresh(batch)
        return batch

    @staticmethod
    def get_batch(
        db: Session,
        batch_id: int,
    ) -> Optional[Batch]:
        return (
            db.query(Batch)
            .filter(Batch.id == batch_id, Batch.is_deleted == False)
            .first()
        )

    @staticmethod
    def get_batch_by_number(
        db: Session,
        batch_number: str,
    ) -> Optional[Batch]:
        return (
            db.query(Batch)
            .filter(
                Batch.batch_number == batch_number,
                Batch.is_deleted == False,
            )
            .first()
        )

    @staticmethod
    def list_batches(
        db: Session,
        skip: int = 0,
        limit: int = 100,
        status: Optional[BatchStatus] = None,
        created_by: Optional[str] = None,
    ) -> Tuple[List[Batch], int]:
        query = db.query(Batch).filter(Batch.is_deleted == False)

        if status:
            query = query.filter(Batch.status == status.value)
        if created_by:
            query = query.filter(Batch.created_by == created_by)

        total = query.count()
        batches = query.order_by(Batch.created_at.desc()).offset(skip).limit(limit).all()

        return batches, total

    @staticmethod
    def update_batch(
        db: Session,
        batch_id: int,
        update_data: BatchUpdate,
        updated_by: str,
    ) -> Optional[Batch]:
        batch = BatchService.get_batch(db, batch_id)
        if not batch:
            return None

        update_dict = update_data.model_dump(exclude_unset=True)
        for field, value in update_dict.items():
            setattr(batch, field, value)

        batch.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(batch)

        return batch

    @staticmethod
    def change_state(
        db: Session,
        batch_id: int,
        to_status: BatchStatus,
        changed_by: str,
        reason: str,
        metadata: Optional[Dict] = None,
    ) -> Tuple[Optional[Batch], Optional[StateChange], Optional[str]]:
        batch = BatchService.get_batch(db, batch_id)
        if not batch:
            return None, None, "批次不存在"

        try:
            batch, state_change = VisitorStateMachine.transition(
                db, batch, to_status, changed_by, reason, metadata
            )
            return batch, state_change, None
        except StateTransitionError as e:
            return None, None, str(e)

    @staticmethod
    def delete_batch(
        db: Session,
        batch_id: int,
        deleted_by: str,
    ) -> bool:
        batch = BatchService.get_batch(db, batch_id)
        if not batch:
            return False

        batch.is_deleted = True
        batch.updated_at = datetime.utcnow()

        audit_log = AuditLog(
            batch_id=batch.id,
            action="delete_batch",
            changed_by=deleted_by,
            metadata={"deleted_at": datetime.utcnow().isoformat()},
        )
        db.add(audit_log)
        db.commit()

        return True

    @staticmethod
    def get_batch_detail(
        db: Session,
        batch_id: int,
    ) -> Optional[Dict[str, Any]]:
        batch = BatchService.get_batch(db, batch_id)
        if not batch:
            return None

        material_count = (
            db.query(func.count(Material.id))
            .filter(Material.batch_id == batch_id)
            .scalar()
        )

        visitor_count = (
            db.query(func.count(VisitorRecord.id))
            .filter(VisitorRecord.batch_id == batch_id)
            .scalar()
        )

        state_changes = VisitorStateMachine.get_state_history(db, batch_id)

        return {
            "id": batch.id,
            "batch_number": batch.batch_number,
            "name": batch.name,
            "description": batch.description,
            "status": batch.status,
            "idempotency_key": batch.idempotency_key,
            "idempotency_strategy": batch.idempotency_strategy,
            "created_by": batch.created_by,
            "created_at": batch.created_at,
            "updated_at": batch.updated_at,
            "settled_at": batch.settled_at,
            "archived_at": batch.archived_at,
            "extra_metadata": batch.extra_metadata,
            "material_count": material_count,
            "visitor_record_count": visitor_count,
            "state_changes": state_changes,
        }

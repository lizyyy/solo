from sqlalchemy.orm import Session
from typing import Optional, List, Tuple
from datetime import datetime
from sqlalchemy import or_, and_

from app import models, schemas
from app.models import BatchStatus, UserRole


class StateMachine:
    VALID_TRANSITIONS = {
        BatchStatus.CREATED: [
            BatchStatus.ATTACHMENTS_UPLOADED,
            BatchStatus.FROZEN,
            BatchStatus.ARCHIVED
        ],
        BatchStatus.ATTACHMENTS_UPLOADED: [
            BatchStatus.UNDER_REVIEW,
            BatchStatus.FROZEN,
            BatchStatus.REVERTED
        ],
        BatchStatus.UNDER_REVIEW: [
            BatchStatus.REVIEWED,
            BatchStatus.FROZEN,
            BatchStatus.REVERTED
        ],
        BatchStatus.REVIEWED: [
            BatchStatus.FROZEN,
            BatchStatus.ARCHIVED,
            BatchStatus.REVERTED
        ],
        BatchStatus.FROZEN: [
            BatchStatus.REVERTED,
            BatchStatus.ARCHIVED
        ],
        BatchStatus.REVERTED: [
            BatchStatus.ATTACHMENTS_UPLOADED,
            BatchStatus.UNDER_REVIEW,
            BatchStatus.REVIEWED,
            BatchStatus.FROZEN
        ],
        BatchStatus.ARCHIVED: []
    }

    @classmethod
    def can_transition(cls, from_status: BatchStatus, to_status: BatchStatus) -> bool:
        return to_status in cls.VALID_TRANSITIONS.get(from_status, [])

    @classmethod
    def get_valid_transitions(cls, current_status: BatchStatus) -> List[BatchStatus]:
        return cls.VALID_TRANSITIONS.get(current_status, [])


class BatchCRUD:
    def get_batch(self, db: Session, batch_id: int) -> Optional[models.Batch]:
        return db.query(models.Batch).filter(models.Batch.id == batch_id).first()

    def get_batch_by_no(self, db: Session, batch_no: str) -> Optional[models.Batch]:
        return db.query(models.Batch).filter(models.Batch.batch_no == batch_no).first()

    def get_batches(
        self,
        db: Session,
        status: Optional[BatchStatus] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        search: Optional[str] = None,
        skip: int = 0,
        limit: int = 100
    ) -> Tuple[List[models.Batch], int]:
        query = db.query(models.Batch)

        if status:
            query = query.filter(models.Batch.current_status == status)
        if start_date:
            query = query.filter(models.Batch.created_at >= start_date)
        if end_date:
            query = query.filter(models.Batch.created_at <= end_date)
        if search:
            query = query.filter(
                or_(
                    models.Batch.batch_no.contains(search),
                    models.Batch.transport_order_no.contains(search),
                    models.Batch.origin.contains(search),
                    models.Batch.destination.contains(search)
                )
            )

        total = query.count()
        batches = query.order_by(models.Batch.created_at.desc()).offset(skip).limit(limit).all()
        return batches, total

    def create_batch(self, db: Session, batch_in: schemas.BatchCreate, creator_id: int) -> models.Batch:
        db_batch = models.Batch(
            batch_no=batch_in.batch_no,
            transport_order_no=batch_in.transport_order_no,
            origin=batch_in.origin,
            destination=batch_in.destination,
            departure_date=batch_in.departure_date,
            arrival_date=batch_in.arrival_date,
            total_boxes=batch_in.total_boxes,
            total_amount=batch_in.total_amount,
            current_status=BatchStatus.CREATED
        )
        db.add(db_batch)
        db.flush()

        transition = models.StatusTransition(
            batch_id=db_batch.id,
            from_status=None,
            to_status=BatchStatus.CREATED,
            operator_id=creator_id,
            reason="批次创建"
        )
        db.add(transition)

        if batch_in.box_items:
            for box_item in batch_in.box_items:
                db_box = models.BoxItem(
                    batch_id=db_batch.id,
                    **box_item.model_dump()
                )
                db.add(db_box)

        db.commit()
        db.refresh(db_batch)
        return db_batch

    def update_batch(
        self, db: Session, batch_id: int, batch_in: schemas.BatchUpdate
    ) -> Optional[models.Batch]:
        db_batch = self.get_batch(db, batch_id)
        if not db_batch:
            return None

        update_data = batch_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_batch, field, value)

        db.commit()
        db.refresh(db_batch)
        return db_batch

    def transition_status(
        self,
        db: Session,
        batch_id: int,
        target_status: BatchStatus,
        operator_id: int,
        reason: str
    ) -> Optional[models.Batch]:
        db_batch = self.get_batch(db, batch_id)
        if not db_batch:
            return None

        if not StateMachine.can_transition(db_batch.current_status, target_status):
            raise ValueError(
                f"Invalid status transition from {db_batch.current_status} to {target_status}"
            )

        old_status = db_batch.current_status

        if target_status == BatchStatus.FROZEN:
            db_batch.status_before_frozen = old_status
            db_batch.frozen_reason = reason
        elif target_status == BatchStatus.REVERTED and old_status == BatchStatus.FROZEN:
            if db_batch.status_before_frozen:
                target_status = db_batch.status_before_frozen
                db_batch.status_before_frozen = None
                db_batch.frozen_reason = None

        db_batch.current_status = target_status

        transition = models.StatusTransition(
            batch_id=batch_id,
            from_status=old_status,
            to_status=target_status,
            operator_id=operator_id,
            reason=reason
        )
        db.add(transition)
        db.commit()
        db.refresh(db_batch)
        return db_batch

    def add_box_item(
        self, db: Session, batch_id: int, box_item: schemas.BoxItemCreate
    ) -> Optional[models.BoxItem]:
        db_batch = self.get_batch(db, batch_id)
        if not db_batch:
            return None

        db_box = models.BoxItem(
            batch_id=batch_id,
            **box_item.model_dump()
        )
        db.add(db_box)
        db.commit()
        db.refresh(db_box)
        return db_box

    def get_batch_detail(self, db: Session, batch_id: int) -> Optional[models.Batch]:
        return db.query(models.Batch).filter(models.Batch.id == batch_id).first()

    def get_batch_with_relations(self, db: Session, batch_id: int, user_role: UserRole):
        batch = db.query(models.Batch).filter(models.Batch.id == batch_id).first()
        if not batch:
            return None

        batch.status_history = db.query(models.StatusTransition).filter(
            models.StatusTransition.batch_id == batch_id
        ).order_by(models.StatusTransition.id).all()

        for transition in batch.status_history:
            transition.operator = db.query(models.User).filter(
                models.User.id == transition.operator_id
            ).first()

        batch.attachments = db.query(models.Attachment).filter(
            models.Attachment.batch_id == batch_id
        ).all()

        batch.box_items = db.query(models.BoxItem).filter(
            models.BoxItem.batch_id == batch_id
        ).all()

        batch.dirty_records = db.query(models.DirtyRecord).filter(
            models.DirtyRecord.batch_id == batch_id
        ).all()

        batch.notes = db.query(models.SupervisorNote).filter(
            models.SupervisorNote.batch_id == batch_id
        ).order_by(models.SupervisorNote.created_at.desc()).all()

        for note in batch.notes:
            note.author = db.query(models.User).filter(
                models.User.id == note.author_id
            ).first()

        return batch


batch_crud = BatchCRUD()

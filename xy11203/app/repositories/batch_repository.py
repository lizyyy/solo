from typing import List, Optional
from sqlalchemy.orm import Session
from app.models.models import Batch
from app.models.enums import BatchStatus


class BatchRepository:
    def __init__(self):
        pass

    def get_by_batch_no(self, db: Session, batch_no: str) -> Optional[Batch]:
        return db.query(Batch).filter(Batch.batch_no == batch_no).first()

    def get_by_import_hash(self, db: Session, import_hash: str) -> Optional[Batch]:
        return db.query(Batch).filter(Batch.import_hash == import_hash).first()

    def get_by_status(self, db: Session, status: BatchStatus) -> List[Batch]:
        return db.query(Batch).filter(Batch.status == status).all()

    def get_by_medicine(self, db: Session, medicine_id: int) -> List[Batch]:
        return db.query(Batch).filter(Batch.medicine_id == medicine_id).all()

    def get_duplicate_batches(self, db: Session, batch_no: str, exclude_id: Optional[int] = None) -> List[Batch]:
        query = db.query(Batch).filter(Batch.batch_no == batch_no)
        if exclude_id:
            query = query.filter(Batch.id != exclude_id)
        return query.all()

    def update_status(self, db: Session, batch_id: int, status: BatchStatus) -> Optional[Batch]:
        batch = db.query(Batch).filter(Batch.id == batch_id).first()
        if batch:
            batch.status = status
            db.commit()
            db.refresh(batch)
        return batch

    def list_all(self, db: Session, skip: int = 0, limit: int = 100) -> List[Batch]:
        return db.query(Batch).order_by(Batch.created_at.desc()).offset(skip).limit(limit).all()

from sqlalchemy.orm import Session
from typing import Optional, List

from app import models, schemas


class NoteCRUD:
    def get_note(self, db: Session, note_id: int) -> Optional[models.SupervisorNote]:
        return db.query(models.SupervisorNote).filter(
            models.SupervisorNote.id == note_id
        ).first()

    def get_notes_by_batch(self, db: Session, batch_id: int) -> List[models.SupervisorNote]:
        return db.query(models.SupervisorNote).filter(
            models.SupervisorNote.batch_id == batch_id
        ).order_by(models.SupervisorNote.created_at.desc()).all()

    def create_note(
        self,
        db: Session,
        batch_id: int,
        note_in: schemas.SupervisorNoteCreate,
        author_id: int
    ) -> models.SupervisorNote:
        db_note = models.SupervisorNote(
            batch_id=batch_id,
            author_id=author_id,
            **note_in.model_dump()
        )
        db.add(db_note)
        db.commit()
        db.refresh(db_note)
        return db_note

    def delete_note(self, db: Session, note_id: int) -> bool:
        db_note = self.get_note(db, note_id)
        if not db_note:
            return False
        db.delete(db_note)
        db.commit()
        return True


note_crud = NoteCRUD()

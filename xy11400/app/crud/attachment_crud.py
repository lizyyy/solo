from sqlalchemy.orm import Session
from typing import Optional, List
import os
import shutil
from datetime import datetime

from app import models, schemas
from app.config import settings


class AttachmentCRUD:
    def get_attachment(self, db: Session, attachment_id: int) -> Optional[models.Attachment]:
        return db.query(models.Attachment).filter(models.Attachment.id == attachment_id).first()

    def get_attachments_by_batch(self, db: Session, batch_id: int) -> List[models.Attachment]:
        return db.query(models.Attachment).filter(
            models.Attachment.batch_id == batch_id
        ).order_by(models.Attachment.upload_time.desc()).all()

    def create_attachment(
        self,
        db: Session,
        batch_id: int,
        attachment_in: schemas.AttachmentCreate
    ) -> models.Attachment:
        db_attachment = models.Attachment(
            batch_id=batch_id,
            **attachment_in.model_dump()
        )
        db.add(db_attachment)
        db.commit()
        db.refresh(db_attachment)
        return db_attachment

    def delete_attachment(self, db: Session, attachment_id: int) -> bool:
        db_attachment = self.get_attachment(db, attachment_id)
        if not db_attachment:
            return False

        try:
            if os.path.exists(db_attachment.file_path):
                os.remove(db_attachment.file_path)
        except Exception:
            pass

        db.delete(db_attachment)
        db.commit()
        return True

    def save_uploaded_file(
        self,
        file_content: bytes,
        filename: str,
        batch_no: str,
        file_type: models.AttachmentType
    ) -> str:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        safe_filename = f"{batch_no}_{file_type.value}_{timestamp}_{filename}"
        safe_filename = safe_filename.replace(" ", "_").replace("/", "_")

        batch_dir = os.path.join(settings.UPLOAD_DIR, batch_no)
        os.makedirs(batch_dir, exist_ok=True)

        file_path = os.path.join(batch_dir, safe_filename)
        with open(file_path, "wb") as f:
            f.write(file_content)

        return file_path


attachment_crud = AttachmentCRUD()

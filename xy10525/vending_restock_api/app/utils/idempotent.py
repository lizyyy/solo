from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from app.models.models import IdempotentRecord
from app.config import settings
import json


class IdempotentManager:
    def __init__(self, db: Session):
        self.db = db

    def check_and_get(self, idempotent_key: str, operation: str) -> IdempotentRecord:
        self._cleanup_expired()
        record = self.db.query(IdempotentRecord).filter(
            IdempotentRecord.idempotent_key == idempotent_key,
            IdempotentRecord.operation == operation
        ).first()
        return record

    def record(self, idempotent_key: str, operation: str, resource_id: str = None, response_data: dict = None) -> IdempotentRecord:
        expires_at = datetime.utcnow() + timedelta(hours=settings.IDEMPOTENT_EXPIRE_HOURS)
        record = IdempotentRecord(
            idempotent_key=idempotent_key,
            operation=operation,
            resource_id=resource_id,
            response_data=json.dumps(response_data) if response_data else None,
            expires_at=expires_at
        )
        self.db.add(record)
        self.db.commit()
        self.db.refresh(record)
        return record

    def _cleanup_expired(self):
        self.db.query(IdempotentRecord).filter(
            IdempotentRecord.expires_at < datetime.utcnow()
        ).delete()
        self.db.commit()


def generate_key(prefix: str, *parts) -> str:
    return f"{prefix}:{':'.join(str(p) for p in parts)}"

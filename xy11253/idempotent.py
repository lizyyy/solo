import hashlib
import json
from datetime import datetime, timedelta
from typing import Optional, Any
from sqlalchemy.orm import Session
from models import IdempotentKey


class IdempotentManager:
    DEFAULT_EXPIRY_HOURS = 24

    @classmethod
    def generate_key(cls, operation_type: str, data: Any) -> str:
        data_str = json.dumps(data, sort_keys=True, default=str)
        hash_obj = hashlib.sha256(data_str.encode())
        return f"{operation_type}:{hash_obj.hexdigest()}"

    @classmethod
    def check_and_set(cls, db: Session, idempotent_key: str, operation_type: str, reference_id: Optional[str] = None, result_data: Optional[Any] = None) -> tuple[bool, Optional[str]]:
        existing = db.query(IdempotentKey).filter(IdempotentKey.key == idempotent_key).first()
        if existing:
            if existing.expires_at and existing.expires_at > datetime.utcnow():
                return True, existing.result_hash
            db.delete(existing)
            db.commit()

        result_hash = None
        if result_data:
            result_str = json.dumps(result_data, sort_keys=True, default=str)
            result_hash = hashlib.sha256(result_str.encode()).hexdigest()

        new_key = IdempotentKey(
            key=idempotent_key,
            operation_type=operation_type,
            reference_id=reference_id,
            result_hash=result_hash,
            expires_at=datetime.utcnow() + timedelta(hours=cls.DEFAULT_EXPIRY_HOURS)
        )
        db.add(new_key)
        db.commit()

        return False, result_hash

    @classmethod
    def get_existing_result(cls, db: Session, idempotent_key: str) -> Optional[str]:
        existing = db.query(IdempotentKey).filter(IdempotentKey.key == idempotent_key).first()
        if existing and (not existing.expires_at or existing.expires_at > datetime.utcnow()):
            return existing.result_hash
        return None

    @classmethod
    def clean_expired(cls, db: Session) -> int:
        expired = db.query(IdempotentKey).filter(IdempotentKey.expires_at <= datetime.utcnow()).all()
        count = len(expired)
        for key in expired:
            db.delete(key)
        db.commit()
        return count

from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from datetime import datetime, timedelta
from models import ImportLock
from config import settings
import uuid


class DistributedLock:
    def __init__(self, db: Session, lock_key: str, timeout: int = None):
        self.db = db
        self.lock_key = lock_key
        self.timeout = timeout or settings.IMPORT_LOCK_TIMEOUT
        self.lock_id = None
        self.acquired = False

    def acquire(self) -> bool:
        current_lock = self.db.query(ImportLock).filter(
            ImportLock.lock_key == self.lock_key
        ).first()
        
        now = datetime.utcnow()
        
        if current_lock:
            if current_lock.expires_at > now:
                return False
            self.db.delete(current_lock)
            self.db.commit()
        
        self.lock_id = str(uuid.uuid4())
        expires_at = now + timedelta(seconds=self.timeout)
        
        try:
            new_lock = ImportLock(
                lock_key=self.lock_key,
                held_by=self.lock_id,
                acquired_at=now,
                expires_at=expires_at
            )
            self.db.add(new_lock)
            self.db.commit()
            self.acquired = True
            return True
        except IntegrityError:
            self.db.rollback()
            return False

    def release(self):
        if self.acquired and self.lock_id:
            self.db.query(ImportLock).filter(
                ImportLock.lock_key == self.lock_key,
                ImportLock.held_by == self.lock_id
            ).delete()
            self.db.commit()
            self.acquired = False

    def __enter__(self):
        if not self.acquire():
            raise RuntimeError(f"无法获取锁: {self.lock_key}")
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.release()


def acquire_import_lock(db: Session, enterprise_id: str = "global") -> bool:
    lock = DistributedLock(db, f"import:{enterprise_id}")
    return lock.acquire()


def release_import_lock(db: Session, enterprise_id: str = "global"):
    db.query(ImportLock).filter(
        ImportLock.lock_key == f"import:{enterprise_id}"
    ).delete()
    db.commit()

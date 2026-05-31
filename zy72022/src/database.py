from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from contextlib import contextmanager
import hashlib
import os
from datetime import datetime

from .config import DB_URL, DB_PATH
from .models import Base, ProcessingState

engine = create_engine(
    DB_URL,
    echo=False,
    connect_args={"check_same_thread": False}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db():
    Base.metadata.create_all(bind=engine)


@contextmanager
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def calculate_file_hash(file_path: str) -> str:
    hash_md5 = hashlib.md5()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            hash_md5.update(chunk)
    return hash_md5.hexdigest()


def check_file_already_processed(db: Session, file_path: str) -> bool:
    file_name = os.path.basename(file_path)
    try:
        file_hash = calculate_file_hash(file_path)
    except Exception:
        file_hash = None

    state = db.query(ProcessingState).filter(
        ProcessingState.file_name == file_name,
        ProcessingState.file_hash == file_hash,
        ProcessingState.status == "success"
    ).first()

    return state is not None


def mark_file_processed(
    db: Session,
    file_path: str,
    record_count: int = 0,
    status: str = "success",
    error_message: str = None
):
    file_name = os.path.basename(file_path)
    try:
        file_hash = calculate_file_hash(file_path)
    except Exception:
        file_hash = None

    state_id = f"proc_{file_name}_{datetime.now().strftime('%Y%m%d%H%M%S')}"

    state = ProcessingState(
        id=state_id,
        file_name=file_name,
        file_hash=file_hash,
        last_processed=datetime.now(),
        record_count=record_count,
        status=status,
        error_message=error_message
    )

    db.add(state)
    db.commit()


def verify_database_integrity() -> dict:
    from .models import AuctionDeposit, AuditLog, EvidenceLink

    result = {
        "db_exists": DB_PATH.exists(),
        "deposit_count": 0,
        "audit_log_count": 0,
        "evidence_link_count": 0,
        "total_confirmed_amount": 0.0,
        "total_suspended_amount": 0.0,
        "export_consistent": True
    }

    if not result["db_exists"]:
        return result

    try:
        with get_db() as db:
            result["deposit_count"] = db.query(AuctionDeposit).count()
            result["audit_log_count"] = db.query(AuditLog).count()
            result["evidence_link_count"] = db.query(EvidenceLink).count()

            confirmed = db.query(AuctionDeposit).filter(
                AuctionDeposit.status == "confirmed"
            ).all()
            result["total_confirmed_amount"] = sum(d.confirmed_amount for d in confirmed)

            suspended = db.query(AuctionDeposit).filter(
                AuctionDeposit.status == "suspended"
            ).all()
            result["total_suspended_amount"] = sum(d.suspended_amount for d in suspended)

    except Exception as e:
        result["export_consistent"] = False
        result["error"] = str(e)

    return result

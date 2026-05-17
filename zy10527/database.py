from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import json

SQLALCHEMY_DATABASE_URL = "sqlite:///./announcement.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def log_audit(db, operation_type, original_input=None, processing_result=None, error_message=None, operator=None, ip_address=None, request_id=None):
    from models import AuditLog
    audit_log = AuditLog(
        operation_type=operation_type,
        original_input=json.dumps(original_input) if original_input else None,
        processing_result=json.dumps(processing_result) if processing_result else None,
        error_message=error_message,
        operator=operator,
        ip_address=ip_address,
        request_id=request_id
    )
    db.add(audit_log)
    db.commit()

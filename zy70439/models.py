from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Enum as SQLEnum
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
from enum import Enum

DATABASE_URL = "sqlite:///./auth_recovery.db"
Base = declarative_base()


class RiskType(str, Enum):
    NORMAL = "NORMAL"
    DUPLICATE_SUBMISSION = "DUPLICATE_SUBMISSION"
    AMOUNT_MISMATCH = "AMOUNT_MISMATCH"
    ACCOUNT_MISMATCH = "ACCOUNT_MISMATCH"
    TIMEOUT = "TIMEOUT"
    CHANNEL_ERROR = "CHANNEL_ERROR"


class BatchStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class Batch(Base):
    __tablename__ = "batches"
    
    id = Column(Integer, primary_key=True, index=True)
    batch_name = Column(String, index=True)
    operator = Column(String, index=True)
    content_hash = Column(String, unique=True, index=True)
    status = Column(String, default=BatchStatus.PENDING)
    total_count = Column(Integer, default=0)
    exception_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class AuthRecord(Base):
    __tablename__ = "auth_records"
    
    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, index=True)
    business_order_no = Column(String, index=True)
    channel = Column(String)
    payer_account = Column(String)
    payee_account = Column(String)
    amount = Column(Float)
    receipt_no = Column(String, index=True)
    receipt_time = Column(String)
    operator = Column(String, index=True)
    risk_type = Column(SQLEnum(RiskType), default=RiskType.NORMAL)
    exception_desc = Column(String, nullable=True)
    sequence = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)


def get_engine():
    return create_engine(DATABASE_URL, connect_args={"check_same_thread": False})


def get_session_local():
    engine = get_engine()
    return sessionmaker(autocommit=False, autoflush=False, bind=engine)


def create_tables():
    engine = get_engine()
    Base.metadata.create_all(bind=engine)


def get_session():
    SessionLocal = get_session_local()
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def Session():
    return next(get_session())


def get_batch_by_hash(content_hash: str):
    session = Session()
    return session.query(Batch).filter(Batch.content_hash == content_hash).first()


def create_batch(operator: str, batch_name: str, content_hash: str, total_count: int):
    session = Session()
    batch = Batch(
        operator=operator,
        batch_name=batch_name,
        content_hash=content_hash,
        total_count=total_count,
        status=BatchStatus.PROCESSING
    )
    session.add(batch)
    session.commit()
    session.refresh(batch)
    return batch


def update_batch_status(batch_id: int, status: str, exception_count: int = 0):
    session = Session()
    batch = session.query(Batch).filter(Batch.id == batch_id).first()
    if batch:
        batch.status = status
        batch.exception_count = exception_count
        session.commit()


def create_auth_record(**kwargs):
    session = Session()
    record = AuthRecord(**kwargs)
    session.add(record)
    session.commit()
    session.refresh(record)
    return record


def get_records_by_batch(batch_id: int):
    session = Session()
    return session.query(AuthRecord).filter(AuthRecord.batch_id == batch_id).all()


def get_all_batches():
    session = Session()
    return session.query(Batch).order_by(Batch.created_at.desc()).all()


def get_records_by_filters(batch_id: int = None, operator: str = None, risk_type: RiskType = None):
    session = Session()
    query = session.query(AuthRecord)
    if batch_id:
        query = query.filter(AuthRecord.batch_id == batch_id)
    if operator:
        query = query.filter(AuthRecord.operator == operator)
    if risk_type:
        query = query.filter(AuthRecord.risk_type == risk_type)
    return query.order_by(AuthRecord.created_at.desc()).all()

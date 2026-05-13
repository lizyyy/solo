from enum import Enum as PyEnum
from datetime import datetime, timedelta
from sqlalchemy import Column, String, Integer, DateTime, Text, Enum, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, sessionmaker
from sqlalchemy import create_engine

Base = declarative_base()

class MessageStatus(PyEnum):
    PENDING = "pending"
    PROCESSING = "processing"
    SUCCESS = "success"
    FAILED = "failed"
    CANCELLED = "cancelled"

STATUS_TRANSITIONS = {
    MessageStatus.PENDING: [MessageStatus.PROCESSING, MessageStatus.CANCELLED],
    MessageStatus.PROCESSING: [MessageStatus.SUCCESS, MessageStatus.FAILED, MessageStatus.CANCELLED],
    MessageStatus.FAILED: [MessageStatus.PENDING, MessageStatus.CANCELLED],
    MessageStatus.SUCCESS: [],
    MessageStatus.CANCELLED: []
}

class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    message_id = Column(String(100), unique=True, nullable=False, index=True)
    source = Column(String(100), nullable=False)
    business_key = Column(String(200), nullable=False, index=True)
    status = Column(Enum(MessageStatus), default=MessageStatus.PENDING, nullable=False)
    deduplication_window = Column(Integer, default=86400)
    payload = Column(Text)
    failure_reason = Column(Text)
    retry_count = Column(Integer, default=0)
    max_retries = Column(Integer, default=3)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    processed_at = Column(DateTime)

    receipts = relationship("Receipt", back_populates="message", cascade="all, delete-orphan")
    status_history = relationship("StatusHistory", back_populates="message", cascade="all, delete-orphan")

class StatusHistory(Base):
    __tablename__ = "status_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    message_id = Column(Integer, ForeignKey("messages.id"), nullable=False)
    from_status = Column(Enum(MessageStatus))
    to_status = Column(Enum(MessageStatus), nullable=False)
    reason = Column(String(500))
    operator = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)

    message = relationship("Message", back_populates="status_history")

class Receipt(Base):
    __tablename__ = "receipts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    message_id = Column(Integer, ForeignKey("messages.id"), nullable=False)
    receipt_type = Column(String(50), nullable=False)
    receipt_data = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    message = relationship("Message", back_populates="receipts")

DATABASE_URL = "sqlite:///./idempotent_inbox.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def init_db():
    Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

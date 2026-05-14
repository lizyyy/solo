from sqlalchemy import create_engine, Column, String, Integer, DateTime, Boolean, Text, JSON, Float, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./notification_preferences.db")

engine = create_engine(
    DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


class UserPreference(Base):
    __tablename__ = "user_preferences"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True, nullable=False)
    request_id = Column(String, unique=True, index=True, nullable=False)
    channel = Column(String, nullable=False)
    topics = Column(JSON, nullable=False)
    dnd_start_time = Column(String)
    dnd_end_time = Column(String)
    dnd_enabled = Column(Boolean, default=False)
    status = Column(String, default="active")
    version = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = Column(String)
    updated_by = Column(String)
    metadata = Column(JSON, default={})
    
    receipts = relationship("SendReceipt", back_populates="preference")
    retry_records = relationship("RetryRecord", back_populates="preference")


class SendReceipt(Base):
    __tablename__ = "send_receipts"
    
    id = Column(Integer, primary_key=True, index=True)
    preference_id = Column(Integer, ForeignKey("user_preferences.id"))
    message_id = Column(String, unique=True, index=True, nullable=False)
    request_id = Column(String, index=True)
    user_id = Column(String, index=True)
    channel = Column(String)
    topic = Column(String)
    status = Column(String, default="pending")
    sent_at = Column(DateTime)
    delivered_at = Column(DateTime)
    read_at = Column(DateTime)
    failed_at = Column(DateTime)
    error_code = Column(String)
    error_message = Column(Text)
    retry_count = Column(Integer, default=0)
    metadata = Column(JSON, default={})
    created_at = Column(DateTime, default=datetime.utcnow)
    
    preference = relationship("UserPreference", back_populates="receipts")
    retry_records = relationship("RetryRecord", back_populates="receipt")


class RetryRecord(Base):
    __tablename__ = "retry_records"
    
    id = Column(Integer, primary_key=True, index=True)
    preference_id = Column(Integer, ForeignKey("user_preferences.id"))
    receipt_id = Column(Integer, ForeignKey("send_receipts.id"))
    retry_number = Column(Integer, nullable=False)
    status = Column(String, default="pending")
    manual_confirmed = Column(Boolean, default=False)
    confirmed_by = Column(String)
    confirmed_at = Column(DateTime)
    executed_at = Column(DateTime)
    result = Column(String)
    error_message = Column(Text)
    metadata = Column(JSON, default={})
    created_at = Column(DateTime, default=datetime.utcnow)
    
    preference = relationship("UserPreference", back_populates="retry_records")
    receipt = relationship("SendReceipt", back_populates="retry_records")


class VersionHistory(Base):
    __tablename__ = "version_histories"
    
    id = Column(Integer, primary_key=True, index=True)
    preference_id = Column(Integer, index=True)
    user_id = Column(String, index=True)
    version = Column(Integer, nullable=False)
    channel = Column(String)
    topics = Column(JSON)
    dnd_start_time = Column(String)
    dnd_end_time = Column(String)
    dnd_enabled = Column(Boolean)
    status = Column(String)
    change_reason = Column(String)
    changed_by = Column(String)
    snapshot = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)


class IdempotentRequest(Base):
    __tablename__ = "idempotent_requests"
    
    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(String, unique=True, index=True, nullable=False)
    request_type = Column(String)
    user_id = Column(String)
    status = Column(String, default="processing")
    result = Column(JSON)
    error_message = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime)


class ExportRecord(Base):
    __tablename__ = "export_records"
    
    id = Column(Integer, primary_key=True, index=True)
    export_id = Column(String, unique=True, index=True, nullable=False)
    export_type = Column(String, nullable=False)
    filters = Column(JSON)
    file_path = Column(String)
    file_name = Column(String)
    status = Column(String, default="processing")
    total_records = Column(Integer, default=0)
    error_message = Column(Text)
    created_by = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)
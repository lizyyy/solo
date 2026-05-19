import os
from datetime import datetime
from typing import Optional, Dict, Any
from sqlalchemy import create_engine, Column, Integer, String, DateTime, Text, Boolean, ForeignKey, Float
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship, Session

DB_PATH = os.path.expanduser("~/.homestay_admin/data.db")
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)

SQLALCHEMY_DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


class Room(Base):
    __tablename__ = "rooms"

    id = Column(Integer, primary_key=True, index=True)
    room_number = Column(String(50), unique=True, index=True, nullable=False)
    room_name = Column(String(100))
    floor = Column(Integer)
    room_type = Column(String(50))
    status = Column(String(50), default="available")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    cleaning_records = relationship("CleaningRecord", back_populates="room")
    photos = relationship("Photo", back_populates="room")


class CleaningRecord(Base):
    __tablename__ = "cleaning_records"

    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(Integer, ForeignKey("rooms.id"))
    cleaner_name = Column(String(100))
    cleaner_phone = Column(String(20))
    checkin_date = Column(DateTime)
    checkout_date = Column(DateTime)
    cleaning_date = Column(DateTime, nullable=False)
    cleaning_status = Column(String(50), default="pending")
    quality_score = Column(Float)
    has_complaint = Column(Boolean, default=False)
    complaint_count = Column(Integer, default=0)
    rework_count = Column(Integer, default=0)
    notes = Column(Text)
    source_file = Column(String(255))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    room = relationship("Room", back_populates="cleaning_records")
    photos = relationship("Photo", back_populates="cleaning_record")
    complaints = relationship("Complaint", back_populates="cleaning_record")


class Photo(Base):
    __tablename__ = "photos"

    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(Integer, ForeignKey("rooms.id"))
    cleaning_record_id = Column(Integer, ForeignKey("cleaning_records.id"))
    file_name = Column(String(255), nullable=False)
    file_path = Column(String(500))
    photo_type = Column(String(50))
    upload_time = Column(DateTime)
    is_approved = Column(Boolean, default=False)
    notes = Column(Text)
    source_file = Column(String(255))
    created_at = Column(DateTime, default=datetime.utcnow)

    room = relationship("Room", back_populates="photos")
    cleaning_record = relationship("CleaningRecord", back_populates="photos")


class Complaint(Base):
    __tablename__ = "complaints"

    id = Column(Integer, primary_key=True, index=True)
    cleaning_record_id = Column(Integer, ForeignKey("cleaning_records.id"))
    complaint_type = Column(String(100))
    description = Column(Text)
    complaint_time = Column(DateTime)
    handler = Column(String(100))
    handler_phone = Column(String(20))
    is_resolved = Column(Boolean, default=False)
    resolution = Column(Text)
    deduction_amount = Column(Float, default=0.0)
    source_file = Column(String(255))
    created_at = Column(DateTime, default=datetime.utcnow)

    cleaning_record = relationship("CleaningRecord", back_populates="complaints")


class ImportRecord(Base):
    __tablename__ = "import_records"

    id = Column(Integer, primary_key=True, index=True)
    file_name = Column(String(255), nullable=False)
    file_path = Column(String(500))
    file_type = Column(String(50), nullable=False)
    total_records = Column(Integer, default=0)
    success_count = Column(Integer, default=0)
    failed_count = Column(Integer, default=0)
    imported_by = Column(String(100))
    imported_at = Column(DateTime, default=datetime.utcnow)

    error_records = relationship("ErrorRecord", back_populates="import_record")


class ErrorRecord(Base):
    __tablename__ = "error_records"

    id = Column(Integer, primary_key=True, index=True)
    import_record_id = Column(Integer, ForeignKey("import_records.id"))
    original_position = Column(String(100))
    original_data = Column(Text)
    error_type = Column(String(100))
    error_message = Column(Text)
    suggestion = Column(Text)
    is_resolved = Column(Boolean, default=False)
    resolved_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)

    import_record = relationship("ImportRecord", back_populates="error_records")


class OperationHistory(Base):
    __tablename__ = "operation_history"

    id = Column(Integer, primary_key=True, index=True)
    operation_type = Column(String(100), nullable=False)
    operation_details = Column(Text)
    operator = Column(String(100))
    ip_address = Column(String(50))
    affected_records = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)


def get_db() -> Session:
    db = SessionLocal()
    try:
        return db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)

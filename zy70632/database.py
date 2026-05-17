from sqlalchemy import create_engine, Column, Integer, String, DateTime, Float, ForeignKey, Text, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
import os

DATABASE_URL = "sqlite:///./food_sample.db"

engine = create_engine(
    DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class Batch(Base):
    __tablename__ = "batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_no = Column(String, unique=True, index=True, nullable=False)
    dish_name = Column(String, nullable=False)
    production_date = Column(DateTime, nullable=False)
    quantity = Column(Float, nullable=False)
    operator = Column(String, nullable=False)
    remark = Column(Text, nullable=True)
    status = Column(String, default="active")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    samples = relationship("SampleBox", back_populates="batch")
    inspections = relationship("Inspection", back_populates="batch")


class StorageLocation(Base):
    __tablename__ = "storage_locations"

    id = Column(Integer, primary_key=True, index=True)
    location_code = Column(String, unique=True, index=True, nullable=False)
    location_name = Column(String, nullable=False)
    refrigerator_no = Column(String, nullable=False)
    shelf_no = Column(String, nullable=False)
    temperature = Column(Float, nullable=True)
    is_available = Column(Boolean, default=True)
    remark = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    samples = relationship("SampleBox", back_populates="storage_location")


class SampleBox(Base):
    __tablename__ = "sample_boxes"

    id = Column(Integer, primary_key=True, index=True)
    box_no = Column(String, unique=True, index=True, nullable=False)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=False)
    storage_location_id = Column(Integer, ForeignKey("storage_locations.id"), nullable=False)
    sample_date = Column(DateTime, nullable=False)
    retention_days = Column(Integer, default=48)
    expiry_date = Column(DateTime, nullable=False)
    status = Column(String, default="stored")
    operator = Column(String, nullable=False)
    remark = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    batch = relationship("Batch", back_populates="samples")
    storage_location = relationship("StorageLocation", back_populates="samples")
    inspections = relationship("Inspection", back_populates="sample_box")
    destruction = relationship("Destruction", back_populates="sample_box", uselist=False)


class Inspection(Base):
    __tablename__ = "inspections"

    id = Column(Integer, primary_key=True, index=True)
    inspection_no = Column(String, unique=True, index=True, nullable=False)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=False)
    sample_box_id = Column(Integer, ForeignKey("sample_boxes.id"), nullable=False)
    inspection_date = Column(DateTime, nullable=False)
    inspector = Column(String, nullable=False)
    appearance = Column(String, nullable=True)
    smell = Column(String, nullable=True)
    taste = Column(String, nullable=True)
    microbiology = Column(String, nullable=True)
    result = Column(String, nullable=False)
    conclusion = Column(String, nullable=False)
    reviewer = Column(String, nullable=True)
    review_date = Column(DateTime, nullable=True)
    review_result = Column(String, nullable=True)
    status = Column(String, default="pending_review")
    remark = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    batch = relationship("Batch", back_populates="inspections")
    sample_box = relationship("SampleBox", back_populates="inspections")


class Destruction(Base):
    __tablename__ = "destructions"

    id = Column(Integer, primary_key=True, index=True)
    destruction_no = Column(String, unique=True, index=True, nullable=False)
    sample_box_id = Column(Integer, ForeignKey("sample_boxes.id"), nullable=False)
    application_date = Column(DateTime, nullable=False)
    applicant = Column(String, nullable=False)
    reason = Column(String, nullable=False)
    reviewer = Column(String, nullable=True)
    review_date = Column(DateTime, nullable=True)
    review_result = Column(String, nullable=True)
    review_remark = Column(Text, nullable=True)
    destruction_date = Column(DateTime, nullable=True)
    destructor = Column(String, nullable=True)
    destruction_method = Column(String, nullable=True)
    witness = Column(String, nullable=True)
    status = Column(String, default="pending_review")
    remark = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    sample_box = relationship("SampleBox", back_populates="destruction")


class ExceptionRecord(Base):
    __tablename__ = "exception_records"

    id = Column(Integer, primary_key=True, index=True)
    exception_no = Column(String, unique=True, index=True, nullable=False)
    related_type = Column(String, nullable=False)
    related_id = Column(Integer, nullable=False)
    original_input = Column(Text, nullable=False)
    operator = Column(String, nullable=False)
    exception_type = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    handler = Column(String, nullable=True)
    handle_date = Column(DateTime, nullable=True)
    conclusion = Column(Text, nullable=True)
    status = Column(String, default="pending")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


def init_db():
    Base.metadata.create_all(bind=engine)

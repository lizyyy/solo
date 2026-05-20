from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, ForeignKey, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime

Base = declarative_base()


class Batch(Base):
    __tablename__ = "batches"
    
    id = Column(Integer, primary_key=True, index=True)
    batch_number = Column(String(50), unique=True, index=True)
    name = Column(String(200))
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by = Column(String(100))
    status = Column(String(50), default="pending")
    total_records = Column(Integer, default=0)
    processed_records = Column(Integer, default=0)
    
    records = relationship("MorningCheckRecord", back_populates="batch")
    processing_logs = relationship("ProcessingLog", back_populates="batch")


class ClassList(Base):
    __tablename__ = "class_lists"
    
    id = Column(Integer, primary_key=True, index=True)
    class_name = Column(String(100))
    class_teacher = Column(String(100))
    student_id = Column(String(50), index=True)
    student_name = Column(String(100))
    parent_name = Column(String(100))
    parent_phone = Column(String(50))
    batch_id = Column(Integer, ForeignKey("batches.id"))
    created_at = Column(DateTime, default=datetime.utcnow)


class MedicationAuthorization(Base):
    __tablename__ = "medication_authorizations"
    
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(String(50), index=True)
    student_name = Column(String(100))
    medication_name = Column(String(200))
    dosage = Column(String(100))
    expiration_date = Column(DateTime)
    parent_signature = Column(String(200))
    signed_at = Column(DateTime)
    batch_id = Column(Integer, ForeignKey("batches.id"))
    created_at = Column(DateTime, default=datetime.utcnow)


class MorningCheckRecord(Base):
    __tablename__ = "morning_check_records"
    
    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"))
    student_id = Column(String(50), index=True)
    student_name = Column(String(100))
    class_name = Column(String(100))
    class_teacher = Column(String(100))
    temperature = Column(Float)
    check_time = Column(DateTime)
    symptoms = Column(Text)
    status = Column(String(50), default="pending")
    need_isolation = Column(Boolean, default=False)
    medication_id = Column(Integer, ForeignKey("medication_authorizations.id"))
    parent_confirmed = Column(Boolean, default=False)
    parent_signature = Column(String(200))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    batch = relationship("Batch", back_populates="records")
    processing_logs = relationship("ProcessingLog", back_populates="record")


class ProcessingLog(Base):
    __tablename__ = "processing_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"))
    record_id = Column(Integer, ForeignKey("morning_check_records.id"))
    action = Column(String(50))
    reason = Column(Text)
    handler = Column(String(100))
    handled_at = Column(DateTime, default=datetime.utcnow)
    details = Column(Text)
    
    batch = relationship("Batch", back_populates="processing_logs")
    record = relationship("MorningCheckRecord", back_populates="processing_logs")

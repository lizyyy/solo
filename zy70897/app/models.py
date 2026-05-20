from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Text, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class Batch(Base):
    __tablename__ = "batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_number = Column(String, unique=True, index=True)
    submitted_at = Column(DateTime, default=datetime.utcnow)
    total_records = Column(Integer, default=0)
    status = Column(String, default="processed")

    handover_records = relationship("HandoverRecord", back_populates="batch")
    error_records = relationship("ErrorRecord", back_populates="batch")


class HandoverRecord(Base):
    __tablename__ = "handover_records"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"))
    handover_date = Column(String)
    branch_code = Column(String)
    branch_name = Column(String)
    teller_from = Column(String)
    teller_to = Column(String)
    cashbox_number = Column(String)
    system_amount = Column(Float)
    actual_amount = Column(Float)
    difference = Column(Float)
    confirmer_1 = Column(String)
    confirmer_2 = Column(String)
    handover_time = Column(String)
    status = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

    batch = relationship("Batch", back_populates="handover_records")
    error_records = relationship("ErrorRecord", back_populates="handover_record")


class ErrorRecord(Base):
    __tablename__ = "error_records"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"))
    handover_record_id = Column(Integer, ForeignKey("handover_records.id"))
    error_code = Column(String, unique=True, index=True)
    error_type = Column(String)
    error_description = Column(String)
    suggestion = Column(Text)
    original_data = Column(Text)
    is_closed = Column(Boolean, default=False)
    closed_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)

    batch = relationship("Batch", back_populates="error_records")
    handover_record = relationship("HandoverRecord", back_populates="error_records")


class TellerSchedule(Base):
    __tablename__ = "teller_schedules"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer)
    schedule_date = Column(String)
    branch_code = Column(String)
    teller_id = Column(String)
    teller_name = Column(String)
    shift_type = Column(String)
    working = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

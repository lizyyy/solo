from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Text, JSON
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime

Base = declarative_base()


class InspectionRecord(Base):
    __tablename__ = "inspection_records"

    id = Column(Integer, primary_key=True, index=True)
    record_type = Column(String(50))
    source_file = Column(String(255))
    row_number = Column(Integer)
    pump_room_id = Column(String(100))
    inspection_time = Column(DateTime)
    inspector_name = Column(String(100))
    inspector_phone = Column(String(50))
    water_pressure = Column(Float)
    water_level = Column(Float)
    pump_status = Column(String(50))
    temperature = Column(Float)
    vibration_level = Column(String(50))
    remarks = Column(Text)
    is_valid = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    raw_data = Column(JSON)


class ErrorRecord(Base):
    __tablename__ = "error_records"

    id = Column(Integer, primary_key=True, index=True)
    source_file = Column(String(255))
    row_number = Column(Integer)
    error_type = Column(String(100))
    error_message = Column(Text)
    suggestion = Column(Text)
    raw_data = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)
    resolved = Column(Boolean, default=False)


class ProcessingHistory(Base):
    __tablename__ = "processing_history"

    id = Column(Integer, primary_key=True, index=True)
    file_name = Column(String(255))
    file_type = Column(String(50))
    total_records = Column(Integer, default=0)
    valid_records = Column(Integer, default=0)
    invalid_records = Column(Integer, default=0)
    processed_at = Column(DateTime, default=datetime.utcnow)
    processed_by = Column(String(100), default="system")
    status = Column(String(50), default="completed")

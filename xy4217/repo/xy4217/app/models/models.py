from sqlalchemy import Column, Integer, String, DateTime, Float, Text, Date
from sqlalchemy.orm import relationship
from app.db.database import Base
from datetime import datetime


class Prescription(Base):
    __tablename__ = "prescriptions"

    id = Column(Integer, primary_key=True, index=True)
    prescription_id = Column(String(50), unique=True, index=True, nullable=False)
    patient_id = Column(String(50), index=True, nullable=False)
    patient_name = Column(String(100), nullable=False)
    drug_name = Column(String(200), nullable=False)
    dose = Column(Float, nullable=False)
    unit = Column(String(20), default="mg")
    prescription_time = Column(DateTime, nullable=False)
    expected_prepare_time = Column(DateTime, nullable=True)
    actual_prepare_time = Column(DateTime, nullable=True)
    status = Column(String(20), default="pending")
    batch_number = Column(String(100), nullable=True)
    drug_id = Column(String(50), nullable=True)
    create_time = Column(DateTime, default=datetime.now)
    update_time = Column(DateTime, default=datetime.now, onupdate=datetime.now)


class DrugBatch(Base):
    __tablename__ = "drug_batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_number = Column(String(100), unique=True, index=True, nullable=False)
    drug_name = Column(String(200), nullable=False)
    drug_id = Column(String(50), nullable=True)
    spec = Column(String(100), nullable=True)
    total_amount = Column(Float, nullable=False)
    unit = Column(String(20), default="mg")
    used_amount = Column(Float, default=0.0)
    remaining_amount = Column(Float, default=0.0)
    expire_date = Column(Date, nullable=False)
    receive_time = Column(DateTime, nullable=True)
    storage_location = Column(String(200), nullable=True)
    supplier = Column(String(200), nullable=True)
    status = Column(String(20), default="active")
    create_time = Column(DateTime, default=datetime.now)
    update_time = Column(DateTime, default=datetime.now, onupdate=datetime.now)


class TemperatureLog(Base):
    __tablename__ = "temperature_logs"

    id = Column(Integer, primary_key=True, index=True)
    fridge_id = Column(String(50), index=True, nullable=False)
    fridge_name = Column(String(100), nullable=True)
    temperature = Column(Float, nullable=False)
    min_temp = Column(Float, nullable=True)
    max_temp = Column(Float, nullable=True)
    log_time = Column(DateTime, nullable=False, index=True)
    status = Column(String(20), default="normal")
    abnormal_reason = Column(Text, nullable=True)
    create_time = Column(DateTime, default=datetime.now)


class WasteRecord(Base):
    __tablename__ = "waste_records"

    id = Column(Integer, primary_key=True, index=True)
    waste_id = Column(String(50), unique=True, index=True, nullable=False)
    prescription_id = Column(String(50), index=True, nullable=True)
    batch_number = Column(String(100), index=True, nullable=False)
    drug_name = Column(String(200), nullable=False)
    waste_amount = Column(Float, nullable=False)
    unit = Column(String(20), default="mg")
    waste_reason = Column(String(500), nullable=False)
    waste_time = Column(DateTime, nullable=False)
    operator = Column(String(100), nullable=True)
    waste_method = Column(String(100), nullable=True)
    closed = Column(Integer, default=0)
    close_time = Column(DateTime, nullable=True)
    closer = Column(String(100), nullable=True)
    remarks = Column(Text, nullable=True)
    create_time = Column(DateTime, default=datetime.now)
    update_time = Column(DateTime, default=datetime.now, onupdate=datetime.now)


class RiskRecord(Base):
    __tablename__ = "risk_records"

    id = Column(Integer, primary_key=True, index=True)
    risk_type = Column(String(50), index=True, nullable=False)
    risk_level = Column(String(20), default="medium")
    description = Column(Text, nullable=False)
    related_prescription_id = Column(String(50), nullable=True)
    related_batch_number = Column(String(100), nullable=True)
    related_fridge_id = Column(String(50), nullable=True)
    related_waste_id = Column(String(50), nullable=True)
    status = Column(String(20), default="pending")
    handler = Column(String(100), nullable=True)
    handle_time = Column(DateTime, nullable=True)
    handle_remark = Column(Text, nullable=True)
    create_time = Column(DateTime, default=datetime.now, index=True)

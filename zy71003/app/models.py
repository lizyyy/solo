from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base


class Slot(Base):
    __tablename__ = "slots"

    id = Column(Integer, primary_key=True, index=True)
    slot_number = Column(String, unique=True, index=True)
    status = Column(String, default="available")
    battery_id = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    temperature_samples = relationship("TemperatureSample", back_populates="slot")
    disable_records = relationship("DisableRecord", back_populates="slot")
    recheck_records = relationship("RecheckRecord", back_populates="slot")


class Battery(Base):
    __tablename__ = "batteries"

    id = Column(Integer, primary_key=True, index=True)
    battery_id = Column(String, unique=True, index=True)
    model = Column(String)
    manufacture_date = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class TemperatureSample(Base):
    __tablename__ = "temperature_samples"

    id = Column(Integer, primary_key=True, index=True)
    slot_id = Column(Integer, ForeignKey("slots.id"))
    battery_id = Column(String)
    temperature = Column(Float)
    sample_time = Column(DateTime(timezone=True), server_default=func.now())
    window_id = Column(String)
    business_no = Column(String, index=True)
    is_anomaly = Column(Boolean, default=False)

    slot = relationship("Slot", back_populates="temperature_samples")


class DisableRecord(Base):
    __tablename__ = "disable_records"

    id = Column(Integer, primary_key=True, index=True)
    slot_id = Column(Integer, ForeignKey("slots.id"))
    battery_id = Column(String)
    reason = Column(String)
    operator = Column(String)
    disable_time = Column(DateTime(timezone=True), server_default=func.now())
    is_active = Column(Boolean, default=True)

    slot = relationship("Slot", back_populates="disable_records")


class RecheckRecord(Base):
    __tablename__ = "recheck_records"

    id = Column(Integer, primary_key=True, index=True)
    slot_id = Column(Integer, ForeignKey("slots.id"))
    battery_id = Column(String)
    recheck_person = Column(String)
    recheck_time = Column(DateTime(timezone=True), server_default=func.now())
    conclusion = Column(String)
    remarks = Column(Text, nullable=True)
    business_no = Column(String, index=True)

    slot = relationship("Slot", back_populates="recheck_records")


class DisposalReport(Base):
    __tablename__ = "disposal_reports"

    id = Column(Integer, primary_key=True, index=True)
    report_no = Column(String, unique=True, index=True)
    battery_id = Column(String)
    slot_number = Column(String)
    anomaly_type = Column(String)
    disposal_method = Column(String)
    operator = Column(String)
    report_time = Column(DateTime(timezone=True), server_default=func.now())
    remarks = Column(Text, nullable=True)
    business_no = Column(String, index=True)


class OperationLog(Base):
    __tablename__ = "operation_logs"

    id = Column(Integer, primary_key=True, index=True)
    operation_type = Column(String)
    slot_number = Column(String, nullable=True)
    battery_id = Column(String, nullable=True)
    business_no = Column(String, nullable=True)
    operator = Column(String, nullable=True)
    details = Column(Text)
    result = Column(String)
    error_code = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

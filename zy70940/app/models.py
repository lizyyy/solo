from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base


class Batch(Base):
    __tablename__ = "batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_no = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(200), nullable=False)
    status = Column(String(20), default="pending")
    created_by = Column(String(50), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    remark = Column(Text)

    waybills = relationship("Waybill", back_populates="batch")
    penalty_records = relationship("PenaltyRecord", back_populates="batch")


class Waybill(Base):
    __tablename__ = "waybills"

    id = Column(Integer, primary_key=True, index=True)
    waybill_no = Column(String(100), index=True, nullable=False)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=False)
    sender = Column(String(100))
    receiver = Column(String(100))
    origin = Column(String(100))
    destination = Column(String(100))
    weight = Column(Float)
    volume = Column(Float)
    expected_delivery = Column(DateTime)
    actual_delivery = Column(DateTime)
    status = Column(String(50), default="normal")
    created_at = Column(DateTime, default=datetime.utcnow)

    batch = relationship("Batch", back_populates="waybills")
    tracking_records = relationship("TrackingRecord", back_populates="waybill")
    penalty_records = relationship("PenaltyRecord", back_populates="waybill")


class TrackingRecord(Base):
    __tablename__ = "tracking_records"

    id = Column(Integer, primary_key=True, index=True)
    waybill_id = Column(Integer, ForeignKey("waybills.id"), nullable=False)
    timestamp = Column(DateTime, nullable=False)
    node = Column(String(100), nullable=False)
    node_type = Column(String(50))
    status = Column(String(100), nullable=False)
    operator = Column(String(50))
    location = Column(String(200))
    temperature = Column(Float)
    remark = Column(Text)

    waybill = relationship("Waybill", back_populates="tracking_records")


class PenaltyRule(Base):
    __tablename__ = "penalty_rules"

    id = Column(Integer, primary_key=True, index=True)
    rule_code = Column(String(50), unique=True, index=True, nullable=False)
    rule_name = Column(String(200), nullable=False)
    penalty_type = Column(String(50), nullable=False)
    penalty_ratio = Column(Float, nullable=False)
    conditions = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class PenaltyRecord(Base):
    __tablename__ = "penalty_records"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=False)
    waybill_id = Column(Integer, ForeignKey("waybills.id"), nullable=False)
    waybill_no = Column(String(100), index=True, nullable=False)
    rule_id = Column(Integer, ForeignKey("penalty_rules.id"))
    rule_code = Column(String(50))
    rule_name = Column(String(200))
    exception_type = Column(String(100), nullable=False)
    exception_reason = Column(Text, nullable=False)
    transfer_node = Column(String(100))
    penalty_ratio = Column(Float, default=0)
    penalty_amount = Column(Float, default=0)
    is_weather_exempt = Column(Boolean, default=False)
    weather_reason = Column(String(500))
    is_cross_transfer = Column(Boolean, default=False)
    cross_transfer_detail = Column(Text)
    is_duplicate = Column(Boolean, default=False)
    original_penalty_id = Column(Integer)
    status = Column(String(20), default="pending")
    process_result = Column(String(20))
    process_reason = Column(Text)
    processed_by = Column(String(50))
    processed_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    batch = relationship("Batch", back_populates="penalty_records")
    waybill = relationship("Waybill", back_populates="penalty_records")
    process_histories = relationship("ProcessHistory", back_populates="penalty_record")


class ProcessHistory(Base):
    __tablename__ = "process_histories"

    id = Column(Integer, primary_key=True, index=True)
    penalty_record_id = Column(Integer, ForeignKey("penalty_records.id"), nullable=False)
    action = Column(String(50), nullable=False)
    old_status = Column(String(20))
    new_status = Column(String(20))
    reason = Column(Text, nullable=False)
    operator = Column(String(50), nullable=False)
    operated_at = Column(DateTime, default=datetime.utcnow)

    penalty_record = relationship("PenaltyRecord", back_populates="process_histories")

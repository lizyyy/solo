from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base


class Owner(Base):
    __tablename__ = "owners"

    id = Column(Integer, primary_key=True, index=True)
    room_number = Column(String(20), unique=True, nullable=False, index=True)
    owner_name = Column(String(50), nullable=False)
    phone = Column(String(20))
    deposit_amount = Column(Float, default=0)
    deposit_frozen = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    renovation_applications = relationship("RenovationApplication", back_populates="owner")
    inspections = relationship("Inspection", back_populates="owner")


class RenovationApplication(Base):
    __tablename__ = "renovation_applications"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(String(30), index=True)
    owner_id = Column(Integer, ForeignKey("owners.id"), nullable=False)
    room_number = Column(String(20), index=True)
    applicant_name = Column(String(50))
    apply_date = Column(String(20))
    renovation_type = Column(String(50))
    contractor = Column(String(100))
    deposit_amount = Column(Float, default=0)
    status = Column(String(20), default="pending")
    remark = Column(Text)
    source_file = Column(String(100))
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    owner = relationship("Owner", back_populates="renovation_applications")
    inspections = relationship("Inspection", back_populates="application")
    processing_records = relationship("ProcessingRecord", back_populates="application")


class Inspection(Base):
    __tablename__ = "inspections"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(String(30), index=True)
    owner_id = Column(Integer, ForeignKey("owners.id"), nullable=False)
    application_id = Column(Integer, ForeignKey("renovation_applications.id"), nullable=True)
    room_number = Column(String(20), index=True)
    inspector = Column(String(50))
    inspect_date = Column(String(20))
    inspect_result = Column(String(50))
    violations = Column(Text)
    rectification_required = Column(Boolean, default=False)
    status = Column(String(20), default="pending")
    remark = Column(Text)
    source_file = Column(String(100))
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    owner = relationship("Owner", back_populates="inspections")
    application = relationship("RenovationApplication", back_populates="inspections")
    processing_records = relationship("ProcessingRecord", back_populates="inspection")


class DeductionRule(Base):
    __tablename__ = "deduction_rules"

    id = Column(Integer, primary_key=True, index=True)
    rule_code = Column(String(30), unique=True, nullable=False)
    rule_name = Column(String(100), nullable=False)
    violation_type = Column(String(50))
    deduction_amount = Column(Float, nullable=False)
    description = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)


class ProcessingRecord(Base):
    __tablename__ = "processing_records"

    id = Column(Integer, primary_key=True, index=True)
    application_id = Column(Integer, ForeignKey("renovation_applications.id"), nullable=True)
    inspection_id = Column(Integer, ForeignKey("inspections.id"), nullable=True)
    room_number = Column(String(20), index=True)
    action_type = Column(String(30), nullable=False)
    previous_status = Column(String(20))
    new_status = Column(String(20))
    reason = Column(Text)
    processor = Column(String(50), nullable=False)
    processing_time = Column(DateTime, default=datetime.now)
    remark = Column(Text)

    application = relationship("RenovationApplication", back_populates="processing_records")
    inspection = relationship("Inspection", back_populates="processing_records")


class RefundRecord(Base):
    __tablename__ = "refund_records"

    id = Column(Integer, primary_key=True, index=True)
    refund_code = Column(String(30), unique=True, index=True)
    room_number = Column(String(20), index=True)
    owner_name = Column(String(50))
    refund_amount = Column(Float, nullable=False)
    refund_reason = Column(Text)
    related_batch_id = Column(String(30))
    approval_status = Column(String(20), default="pending")
    approver = Column(String(50))
    approval_time = Column(DateTime)
    is_duplicate = Column(Boolean, default=False)
    remark = Column(Text)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

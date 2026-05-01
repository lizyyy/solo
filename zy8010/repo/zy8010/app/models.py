from datetime import datetime
from enum import Enum
from sqlalchemy import Column, Integer, String, DateTime, Float, Text, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship, DeclarativeBase


class ReviewStatus(str, Enum):
    PENDING = "pending"
    IN_REVIEW = "in_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    NEEDS_RECTIFICATION = "needs_rectification"


class Base(DeclarativeBase):
    pass


class Prescription(Base):
    __tablename__ = "prescriptions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    prescription_no = Column(String(50), unique=True, nullable=False, index=True)
    patient_name = Column(String(100))
    patient_id = Column(String(50))
    prescription_date = Column(DateTime, nullable=False)
    doctor_name = Column(String(100))
    department = Column(String(100))
    diagnosis = Column(Text)
    batch_no = Column(String(50), index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    items = relationship("PrescriptionItem", back_populates="prescription")
    settlements = relationship("InsuranceSettlement", back_populates="prescription")
    reviews = relationship("ReviewRecord", back_populates="prescription")


class PrescriptionItem(Base):
    __tablename__ = "prescription_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    prescription_id = Column(Integer, ForeignKey("prescriptions.id"), nullable=False, index=True)
    drug_name = Column(String(200), nullable=False)
    drug_code = Column(String(50))
    specification = Column(String(100))
    quantity = Column(Float, nullable=False)
    unit = Column(String(20))
    dosage = Column(String(100))
    batch_no = Column(String(50), index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    prescription = relationship("Prescription", back_populates="items")
    return_records = relationship("DrugReturn", back_populates="prescription_item")


class InsuranceSettlement(Base):
    __tablename__ = "insurance_settlements"

    id = Column(Integer, primary_key=True, autoincrement=True)
    settlement_no = Column(String(50), unique=True, nullable=False, index=True)
    prescription_id = Column(Integer, ForeignKey("prescriptions.id"), nullable=False, index=True)
    settlement_date = Column(DateTime, nullable=False)
    total_amount = Column(Float, default=0)
    insurance_payment = Column(Float, default=0)
    personal_payment = Column(Float, default=0)
    batch_no = Column(String(50), index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    prescription = relationship("Prescription", back_populates="settlements")


class DrugInventory(Base):
    __tablename__ = "drug_inventories"

    id = Column(Integer, primary_key=True, autoincrement=True)
    drug_code = Column(String(50), nullable=False, index=True)
    drug_name = Column(String(200), nullable=False)
    batch_no = Column(String(50), nullable=False, index=True)
    quantity = Column(Float, default=0)
    unit = Column(String(20))
    expiry_date = Column(DateTime)
    manufacturer = Column(String(200))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class DrugReturn(Base):
    __tablename__ = "drug_returns"

    id = Column(Integer, primary_key=True, autoincrement=True)
    return_no = Column(String(50), unique=True, nullable=False, index=True)
    prescription_item_id = Column(Integer, ForeignKey("prescription_items.id"), nullable=False, index=True)
    return_quantity = Column(Float, nullable=False)
    return_date = Column(DateTime, nullable=False)
    return_reason = Column(Text)
    operator = Column(String(100))
    batch_no = Column(String(50), index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    prescription_item = relationship("PrescriptionItem", back_populates="return_records")


class ReviewRecord(Base):
    __tablename__ = "review_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    prescription_id = Column(Integer, ForeignKey("prescriptions.id"), nullable=False, index=True)
    status = Column(SQLEnum(ReviewStatus), default=ReviewStatus.PENDING, nullable=False)
    reviewer = Column(String(100))
    review_comment = Column(Text)
    rectification_note = Column(Text)
    risk_findings = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    prescription = relationship("Prescription", back_populates="reviews")


class RiskFinding(Base):
    __tablename__ = "risk_findings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    prescription_id = Column(Integer, ForeignKey("prescriptions.id"), nullable=False, index=True)
    rule_code = Column(String(50), nullable=False)
    rule_name = Column(String(200), nullable=False)
    severity = Column(String(20), default="medium")
    description = Column(Text)
    affected_data = Column(Text)
    is_resolved = Column(Integer, default=0)
    resolved_comment = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

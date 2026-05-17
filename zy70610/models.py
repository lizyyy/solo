from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime

Base = declarative_base()


class Device(Base):
    __tablename__ = "devices"

    id = Column(Integer, primary_key=True, index=True)
    serial_number = Column(String, unique=True, index=True, nullable=False)
    brand = Column(String)
    model = Column(String)
    storage = Column(String)
    color = Column(String)
    status = Column(String, default="pending")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    inspections = relationship("Inspection", back_populates="device")
    quotes = relationship("Quote", back_populates="device")
    reviews = relationship("Review", back_populates="device")
    reports = relationship("InspectionReport", back_populates="device")


class InspectionItem(Base):
    __tablename__ = "inspection_items"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    category = Column(String, nullable=False)
    max_score = Column(Float, default=10.0)
    weight = Column(Float, default=1.0)
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)


class Inspection(Base):
    __tablename__ = "inspections"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(Integer, ForeignKey("devices.id"))
    item_id = Column(Integer, ForeignKey("inspection_items.id"))
    score = Column(Float, nullable=False)
    inspector = Column(String)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    device = relationship("Device", back_populates="inspections")
    item = relationship("InspectionItem")


class Quote(Base):
    __tablename__ = "quotes"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(Integer, ForeignKey("devices.id"))
    version = Column(Integer, default=1)
    base_price = Column(Float, nullable=False)
    final_price = Column(Float)
    is_frozen = Column(Boolean, default=False)
    frozen_at = Column(DateTime)
    frozen_by = Column(String)
    status = Column(String, default="draft")
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    device = relationship("Device", back_populates="quotes")
    deductions = relationship("Deduction", back_populates="quote")


class DeductionReason(Base):
    __tablename__ = "deduction_reasons"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, unique=True, nullable=False)
    name = Column(String, nullable=False)
    category = Column(String)
    default_amount = Column(Float)
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)


class Deduction(Base):
    __tablename__ = "deductions"

    id = Column(Integer, primary_key=True, index=True)
    quote_id = Column(Integer, ForeignKey("quotes.id"))
    reason_id = Column(Integer, ForeignKey("deduction_reasons.id"))
    amount = Column(Float, nullable=False)
    description = Column(Text)
    recorded_by = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

    quote = relationship("Quote", back_populates="deductions")
    reason = relationship("DeductionReason")


class Review(Base):
    __tablename__ = "reviews"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(Integer, ForeignKey("devices.id"))
    quote_id = Column(Integer, ForeignKey("quotes.id"))
    status = Column(String, default="pending")
    reviewer = Column(String)
    review_notes = Column(Text)
    resolution = Column(String)
    reviewed_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    device = relationship("Device", back_populates="reviews")
    quote = relationship("Quote")


class InspectionReport(Base):
    __tablename__ = "inspection_reports"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(Integer, ForeignKey("devices.id"))
    report_number = Column(String, unique=True, nullable=False)
    total_score = Column(Float)
    final_price = Column(Float)
    status = Column(String, default="generated")
    generated_by = Column(String)
    generated_at = Column(DateTime, default=datetime.utcnow)
    content = Column(Text)

    device = relationship("Device", back_populates="reports")

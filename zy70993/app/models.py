from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey, Index
from sqlalchemy.orm import relationship

from app.database import Base


class Batch(Base):
    __tablename__ = "batches"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(256), nullable=False)
    month = Column(String(7), nullable=False)
    idempotency_key = Column(String(128), unique=True, nullable=False)
    swipe_count = Column(Integer, default=0)
    subsidy_count = Column(Integer, default=0)
    refund_count = Column(Integer, default=0)
    status = Column(String(32), nullable=False, default="uploaded")
    note = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)

    swipes = relationship("SwipeRecord", back_populates="batch", cascade="all, delete-orphan")
    subsidies = relationship("SubsidyRecord", back_populates="batch", cascade="all, delete-orphan")
    refunds = relationship("RefundRecord", back_populates="batch", cascade="all, delete-orphan")
    results = relationship("ReconciliationResult", back_populates="batch", cascade="all, delete-orphan")


class SwipeRecord(Base):
    __tablename__ = "swipe_records"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=False, index=True)
    student_id = Column(String(64), nullable=False, index=True)
    student_name = Column(String(128), default="")
    swipe_time = Column(DateTime, nullable=False, index=True)
    meal_type = Column(String(32), nullable=False)
    amount = Column(Float, nullable=False, default=0.0)
    device = Column(String(128), default="")
    raw = Column(Text, default="")

    batch = relationship("Batch", back_populates="swipes")
    result = relationship("ReconciliationResult", back_populates="swipe", uselist=False, cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_swipe_student_time", "student_id", "swipe_time"),
    )


class SubsidyRecord(Base):
    __tablename__ = "subsidy_records"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=False, index=True)
    student_id = Column(String(64), nullable=False, index=True)
    student_name = Column(String(128), default="")
    monthly_limit = Column(Float, nullable=False, default=0.0)
    subsidy_type = Column(String(64), default="")
    effective_month = Column(String(7), nullable=False)
    note = Column(Text, default="")

    batch = relationship("Batch", back_populates="subsidies")


class RefundRecord(Base):
    __tablename__ = "refund_records"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=False, index=True)
    student_id = Column(String(64), nullable=False, index=True)
    refund_time = Column(DateTime, nullable=False)
    refund_amount = Column(Float, nullable=False, default=0.0)
    related_meal_type = Column(String(32), default="")
    reason = Column(Text, default="")
    raw = Column(Text, default="")

    batch = relationship("Batch", back_populates="refunds")


class ReconciliationResult(Base):
    __tablename__ = "reconciliation_results"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=False, index=True)
    swipe_id = Column(Integer, ForeignKey("swipe_records.id"), nullable=False, unique=True, index=True)
    student_id = Column(String(64), nullable=False, index=True)
    month = Column(String(7), nullable=False, index=True)
    status = Column(String(32), nullable=False)
    reason = Column(Text, default="")
    suggestion = Column(Text, default="")
    consumed_before_this = Column(Float, default=0.0)
    subsidy_limit = Column(Float, default=0.0)
    matched_refund_id = Column(Integer, ForeignKey("refund_records.id"), nullable=True)
    source_trace = Column(Text, default="")

    batch = relationship("Batch", back_populates="results")
    swipe = relationship("SwipeRecord", back_populates="result")
    refund = relationship("RefundRecord", foreign_keys=[matched_refund_id])

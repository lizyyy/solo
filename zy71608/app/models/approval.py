from sqlalchemy import Column, Integer, String, Date, Numeric, Text, ForeignKey, Boolean
from sqlalchemy.orm import relationship

from app.database import Base
from app.models.base import BaseModel


class ApprovalRecord(Base, BaseModel):
    __tablename__ = "approval_records"

    application_id = Column(Integer, ForeignKey("reduction_applications.id"), nullable=False)
    step_order = Column(Integer, default=1)
    step_name = Column(String(50), nullable=False)
    action = Column(String(50), nullable=False)
    approver = Column(String(50), nullable=False)
    approval_date = Column(Date)
    comments = Column(Text)
    status = Column(String(20), default="待处理")
    is_manual_override = Column(Boolean, default=False)
    override_reason = Column(Text)

    application = relationship("ReductionApplication", back_populates="approvals")


class AnomalyFlag(Base, BaseModel):
    __tablename__ = "anomaly_flags"

    application_id = Column(Integer, ForeignKey("reduction_applications.id"), nullable=False)
    anomaly_type = Column(String(50), nullable=False)
    severity = Column(String(20), default="中")
    status = Column(String(20), default="待处理")
    field_name = Column(String(100))
    old_value = Column(Text)
    new_value = Column(Text)
    expected_value = Column(Text)
    description = Column(Text, nullable=False)
    detected_by = Column(String(50), default="system")
    detected_at = Column(Date)
    resolved_by = Column(String(50))
    resolved_at = Column(Date)
    resolution = Column(Text)
    resolution_notes = Column(Text)

    application = relationship("ReductionApplication", back_populates="anomalies")


class ReductionCalculation(Base, BaseModel):
    __tablename__ = "reduction_calculations"

    application_id = Column(Integer, ForeignKey("reduction_applications.id"), nullable=False)
    calculation_version = Column(Integer, default=1)
    is_current = Column(Boolean, default=True)
    calculation_method = Column(String(100))
    daily_rent = Column(Numeric(15, 2))
    daily_service_fee = Column(Numeric(15, 2))
    actual_reduction_days = Column(Integer)
    rent_reduction = Column(Numeric(15, 2))
    service_fee_reduction = Column(Numeric(15, 2))
    other_reduction = Column(Numeric(15, 2), default=0)
    total_reduction = Column(Numeric(15, 2))
    reduction_ratio_applied = Column(Numeric(5, 4), default=1.0)
    calculation_details = Column(Text)
    is_manual_override = Column(Boolean, default=False)
    override_reason = Column(Text)
    override_by = Column(String(50))

    application = relationship("ReductionApplication", back_populates="calculations")

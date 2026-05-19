from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base


class Reagent(Base):
    __tablename__ = "reagents"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    cas_no = Column(String, index=True)
    specification = Column(String)
    danger_level = Column(String, nullable=False)
    unit = Column(String, nullable=False)
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)

    inventory = relationship("Inventory", back_populates="reagent")
    applications = relationship("Application", back_populates="reagent")


class Inventory(Base):
    __tablename__ = "inventory"

    id = Column(Integer, primary_key=True, index=True)
    reagent_id = Column(Integer, ForeignKey("reagents.id"), nullable=False)
    quantity = Column(Float, nullable=False)
    location = Column(String)
    batch_no = Column(String, index=True)
    expired_at = Column(DateTime)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    updated_by = Column(String, nullable=False)

    reagent = relationship("Reagent", back_populates="inventory")


class Application(Base):
    __tablename__ = "applications"

    id = Column(Integer, primary_key=True, index=True)
    application_no = Column(String, unique=True, index=True, nullable=False)
    reagent_id = Column(Integer, ForeignKey("reagents.id"), nullable=False)
    applicant = Column(String, nullable=False)
    applicant_role = Column(String, nullable=False)
    quantity = Column(Float, nullable=False)
    purpose = Column(Text)
    status = Column(String, nullable=False, default="pending")
    current_approval_index = Column(Integer, default=0)
    required_approvals = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    reagent = relationship("Reagent", back_populates="applications")
    approvals = relationship("Approval", back_populates="application", order_by="Approval.approval_index")
    operation_logs = relationship("OperationLog", back_populates="application")


class Approval(Base):
    __tablename__ = "approvals"

    id = Column(Integer, primary_key=True, index=True)
    application_id = Column(Integer, ForeignKey("applications.id"), nullable=False)
    approver = Column(String, nullable=False)
    approver_role = Column(String, nullable=False)
    approval_index = Column(Integer, nullable=False)
    decision = Column(String)
    comment = Column(Text)
    approved_at = Column(DateTime)

    application = relationship("Application", back_populates="approvals")


class OperationLog(Base):
    __tablename__ = "operation_logs"

    id = Column(Integer, primary_key=True, index=True)
    operation_type = Column(String, nullable=False)
    application_id = Column(Integer, ForeignKey("applications.id"))
    reagent_id = Column(Integer, ForeignKey("reagents.id"))
    operator = Column(String, nullable=False)
    operator_role = Column(String, nullable=False)
    quantity = Column(Float)
    result = Column(String, nullable=False)
    reason = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    application = relationship("Application", back_populates="operation_logs")

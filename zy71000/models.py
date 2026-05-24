from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class InstrumentPackage(Base):
    __tablename__ = "instrument_packages"

    id = Column(Integer, primary_key=True, index=True)
    batch_number = Column(String, index=True, unique=True)
    sterilization_cycle = Column(String, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    sterilization_records = relationship("SterilizationRecord", back_populates="package")
    isolation_orders = relationship("IsolationOrder", back_populates="package")


class SterilizationRecord(Base):
    __tablename__ = "sterilization_records"

    id = Column(Integer, primary_key=True, index=True)
    package_id = Column(Integer, ForeignKey("instrument_packages.id"))
    sterilization_cycle = Column(String, index=True)
    sterilizer_id = Column(String)
    start_time = Column(DateTime(timezone=True))
    end_time = Column(DateTime(timezone=True))
    result = Column(String)
    operator = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    package = relationship("InstrumentPackage", back_populates="sterilization_records")


class IsolationOrder(Base):
    __tablename__ = "isolation_orders"

    id = Column(Integer, primary_key=True, index=True)
    order_no = Column(String, unique=True, index=True)
    package_id = Column(Integer, ForeignKey("instrument_packages.id"))
    batch_number = Column(String, index=True)
    sterilization_cycle = Column(String, index=True)
    operating_room = Column(String)
    receiving_nurse = Column(String)
    isolation_reason = Column(Text)
    submission_time = Column(DateTime(timezone=True))
    surgery_time = Column(DateTime(timezone=True))
    is_late_submission = Column(Boolean, default=False)
    cross_room_usage = Column(Boolean, default=False)
    temp_package_change = Column(Boolean, default=False)
    status = Column(String, default="pending")
    final_conclusion = Column(String, nullable=True)
    reviewed_by = Column(String, nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    package = relationship("InstrumentPackage", back_populates="isolation_orders")
    decisions = relationship("DecisionRecord", back_populates="isolation_order", order_by="DecisionRecord.created_at.desc()")


class DecisionRecord(Base):
    __tablename__ = "decision_records"

    id = Column(Integer, primary_key=True, index=True)
    isolation_order_id = Column(Integer, ForeignKey("isolation_orders.id"))
    decision_type = Column(String)
    conclusion = Column(String)
    reason = Column(Text)
    operator = Column(String)
    supplementary_evidence = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    isolation_order = relationship("IsolationOrder", back_populates="decisions")


class UsageRecord(Base):
    __tablename__ = "usage_records"

    id = Column(Integer, primary_key=True, index=True)
    batch_number = Column(String, index=True)
    operating_room = Column(String)
    usage_time = Column(DateTime(timezone=True))
    receiving_nurse = Column(String)
    surgery_id = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

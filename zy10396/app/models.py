import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from app.database import Base


class AllocationStatus(str, enum.Enum):
    DRAFT = "draft"
    VALIDATED = "validated"
    CALCULATING = "calculating"
    COMPLETED = "completed"
    FAILED = "failed"
    ADJUSTED = "adjusted"
    EXPORTED = "exported"


class Caller(Base):
    __tablename__ = "callers"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    department = Column(String(100), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    call_records = relationship("CallRecord", back_populates="caller")
    monthly_results = relationship("MonthlyResult", back_populates="caller")


class ApiGroup(Base):
    __tablename__ = "api_groups"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(50), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    resource_prices = relationship("ResourcePrice", back_populates="api_group")
    call_records = relationship("CallRecord", back_populates="api_group")


class ResourcePrice(Base):
    __tablename__ = "resource_prices"

    id = Column(Integer, primary_key=True, index=True)
    api_group_id = Column(Integer, ForeignKey("api_groups.id"), nullable=False)
    version = Column(Integer, default=1, nullable=False)
    unit_price = Column(Float, nullable=False)
    currency = Column(String(10), default="CNY", nullable=False)
    unit = Column(String(20), default="call", nullable=False)
    effective_date = Column(DateTime, nullable=False)
    expiry_date = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by = Column(String(100), nullable=True)

    api_group = relationship("ApiGroup", back_populates="resource_prices")


class CallRecord(Base):
    __tablename__ = "call_records"

    id = Column(Integer, primary_key=True, index=True)
    caller_id = Column(Integer, ForeignKey("callers.id"), nullable=False)
    api_group_id = Column(Integer, ForeignKey("api_groups.id"), nullable=False)
    call_date = Column(DateTime, nullable=False, index=True)
    call_count = Column(Integer, nullable=False)
    success_count = Column(Integer, default=0)
    fail_count = Column(Integer, default=0)
    request_idempotency_key = Column(String(100), nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    caller = relationship("Caller", back_populates="call_records")
    api_group = relationship("ApiGroup", back_populates="call_records")


class AllocationRule(Base):
    __tablename__ = "allocation_rules"

    id = Column(Integer, primary_key=True, index=True)
    version = Column(Integer, default=1, nullable=False)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    allocation_type = Column(String(50), default="proportional", nullable=False)
    formula = Column(Text, nullable=True)
    rounding_precision = Column(Integer, default=2)
    effective_date = Column(DateTime, nullable=False)
    expiry_date = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by = Column(String(100), nullable=True)


class MonthlyResult(Base):
    __tablename__ = "monthly_results"

    id = Column(Integer, primary_key=True, index=True)
    month = Column(String(7), nullable=False, index=True)
    caller_id = Column(Integer, ForeignKey("callers.id"), nullable=False)
    api_group_id = Column(Integer, ForeignKey("api_groups.id"), nullable=False)
    rule_id = Column(Integer, ForeignKey("allocation_rules.id"), nullable=False)
    rule_version = Column(Integer, nullable=False)
    total_calls = Column(Integer, nullable=False)
    unit_price = Column(Float, nullable=False)
    raw_cost = Column(Float, nullable=False)
    allocated_cost = Column(Float, nullable=False)
    status = Column(String(20), default=AllocationStatus.DRAFT, nullable=False)
    failure_reason = Column(Text, nullable=True)
    idempotency_key = Column(String(100), unique=True, index=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    caller = relationship("Caller", back_populates="monthly_results")
    adjustments = relationship("AdjustmentRecord", back_populates="monthly_result")


class AdjustmentRecord(Base):
    __tablename__ = "adjustment_records"

    id = Column(Integer, primary_key=True, index=True)
    monthly_result_id = Column(Integer, ForeignKey("monthly_results.id"), nullable=False)
    adjustment_amount = Column(Float, nullable=False)
    adjustment_type = Column(String(50), nullable=False)
    reason = Column(Text, nullable=False)
    previous_cost = Column(Float, nullable=False)
    new_cost = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by = Column(String(100), nullable=True)

    monthly_result = relationship("MonthlyResult", back_populates="adjustments")


class IdempotentRecord(Base):
    __tablename__ = "idempotent_records"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(100), unique=True, index=True, nullable=False)
    request_type = Column(String(50), nullable=False)
    response_data = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)

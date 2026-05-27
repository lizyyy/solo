from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base


class Employee(Base):
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    department = Column(String)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class Coupon(Base):
    __tablename__ = "coupons"

    id = Column(Integer, primary_key=True, index=True)
    coupon_code = Column(String, unique=True, index=True, nullable=False)
    coupon_type = Column(String, nullable=False)
    value = Column(String)
    is_used = Column(Boolean, default=False)
    used_by = Column(String)
    used_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ClaimRecord(Base):
    __tablename__ = "claim_records"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(String, index=True, nullable=False)
    employee_id = Column(String, nullable=False)
    employee_name = Column(String, nullable=False)
    coupon_code = Column(String)
    claim_type = Column(String, nullable=False)
    is_proxy = Column(Boolean, default=False)
    proxy_employee_id = Column(String)
    proxy_employee_name = Column(String)
    delivery_method = Column(String)
    address = Column(Text)
    contact_phone = Column(String)
    remark = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Batch(Base):
    __tablename__ = "batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(String, unique=True, index=True, nullable=False)
    file_hash = Column(String, unique=True, index=True, nullable=False)
    file_name = Column(String)
    total_count = Column(Integer, default=0)
    success_count = Column(Integer, default=0)
    pending_count = Column(Integer, default=0)
    failed_count = Column(Integer, default=0)
    status = Column(String, default="completed")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

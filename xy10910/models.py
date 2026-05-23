from sqlalchemy import Column, Integer, String, Float, DateTime, Text, Boolean, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import enum


class DeviceStatus(str, enum.Enum):
    PENDING = "待检测"
    INSPECTING = "检测中"
    INSPECTED = "已检测"
    QUOTED = "已报价"
    REVIEWING = "复核中"
    APPROVED = "已通过"
    REJECTED = "已拒绝"
    SETTLED = "已结算"


class ReviewStatus(str, enum.Enum):
    PENDING = "待复核"
    APPROVED = "复核通过"
    REJECTED = "复核拒绝"
    NEEDS_REVISION = "需修正"


class DeductionType(str, enum.Enum):
    SCREEN = "屏幕问题"
    BATTERY = "电池问题"
    SERIAL = "序列号问题"
    APPEARANCE = "外观问题"
    FUNCTION = "功能问题"
    OTHER = "其他问题"


class Device(Base):
    __tablename__ = "devices"

    id = Column(Integer, primary_key=True, index=True)
    serial_number = Column(String, unique=True, index=True, nullable=False)
    brand = Column(String)
    model = Column(String)
    storage = Column(String)
    color = Column(String)
    status = Column(String, default=DeviceStatus.PENDING)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    inspections = relationship("Inspection", back_populates="device", cascade="all, delete-orphan")
    quotes = relationship("Quote", back_populates="device", cascade="all, delete-orphan")
    reviews = relationship("Review", back_populates="device", cascade="all, delete-orphan")
    reports = relationship("InspectionReport", back_populates="device", cascade="all, delete-orphan")
    status_history = relationship("StatusHistory", back_populates="device", cascade="all, delete-orphan")


class Inspection(Base):
    __tablename__ = "inspections"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(Integer, ForeignKey("devices.id"), nullable=False)
    inspector = Column(String)
    screen_score = Column(Float, default=100.0)
    battery_score = Column(Float, default=100.0)
    appearance_score = Column(Float, default=100.0)
    function_score = Column(Float, default=100.0)
    total_score = Column(Float, default=100.0)
    remarks = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    device = relationship("Device", back_populates="inspections")
    deductions = relationship("Deduction", back_populates="inspection", cascade="all, delete-orphan")


class Deduction(Base):
    __tablename__ = "deductions"

    id = Column(Integer, primary_key=True, index=True)
    inspection_id = Column(Integer, ForeignKey("inspections.id"), nullable=False)
    deduction_type = Column(String, nullable=False)
    description = Column(Text)
    amount = Column(Float, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    inspection = relationship("Inspection", back_populates="deductions")


class Quote(Base):
    __tablename__ = "quotes"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(Integer, ForeignKey("devices.id"), nullable=False)
    version = Column(Integer, default=1)
    initial_price = Column(Float, nullable=False)
    final_price = Column(Float)
    is_frozen = Column(Boolean, default=False)
    frozen_at = Column(DateTime(timezone=True))
    quoted_by = Column(String)
    remarks = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    device = relationship("Device", back_populates="quotes")


class Review(Base):
    __tablename__ = "reviews"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(Integer, ForeignKey("devices.id"), nullable=False)
    reviewer = Column(String)
    status = Column(String, default=ReviewStatus.PENDING)
    comments = Column(Text)
    reviewed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    device = relationship("Device", back_populates="reviews")


class InspectionReport(Base):
    __tablename__ = "inspection_reports"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(Integer, ForeignKey("devices.id"), nullable=False)
    report_number = Column(String, unique=True)
    content = Column(Text)
    generated_at = Column(DateTime(timezone=True), server_default=func.now())
    generated_by = Column(String)

    device = relationship("Device", back_populates="reports")


class StatusHistory(Base):
    __tablename__ = "status_history"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(Integer, ForeignKey("devices.id"), nullable=False)
    from_status = Column(String)
    to_status = Column(String, nullable=False)
    operator = Column(String)
    remarks = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    device = relationship("Device", back_populates="status_history")


class ExceptionLog(Base):
    __tablename__ = "exception_logs"

    id = Column(Integer, primary_key=True, index=True)
    serial_number = Column(String, index=True)
    endpoint = Column(String)
    raw_input = Column(Text)
    error_message = Column(Text)
    resolution = Column(String)
    resolved = Column(Boolean, default=False)
    resolved_by = Column(String)
    resolved_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

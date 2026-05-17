from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import enum


class SettlementStatus(str, enum.Enum):
    DRAFT = "draft"
    PROCESSING = "processing"
    CONFLICT = "conflict"
    CONFIRMED = "confirmed"
    SETTLED = "settled"
    CANCELLED = "cancelled"


class Farmer(Base):
    __tablename__ = "farmers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    phone = Column(String(20))
    id_card = Column(String(50), unique=True)
    village = Column(String(100))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    plots = relationship("Plot", back_populates="farmer")
    confirmations = relationship("Confirmation", back_populates="farmer")
    settlements = relationship("Settlement", back_populates="farmer")


class Plot(Base):
    __tablename__ = "plots"

    id = Column(Integer, primary_key=True, index=True)
    farmer_id = Column(Integer, ForeignKey("farmers.id"))
    plot_code = Column(String(50), unique=True, nullable=False)
    plot_name = Column(String(100))
    location = Column(String(200))
    standard_area = Column(Float, nullable=False)
    land_type = Column(String(50))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    farmer = relationship("Farmer", back_populates="plots")
    gps_records = relationship("GPSRecord", back_populates="plot")
    confirmations = relationship("Confirmation", back_populates="plot")
    settlement_items = relationship("SettlementItem", back_populates="plot")


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    project_code = Column(String(50), unique=True, nullable=False)
    project_name = Column(String(100), nullable=False)
    unit_price = Column(Float, nullable=False)
    unit = Column(String(20), default="mu")
    description = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    gps_records = relationship("GPSRecord", back_populates="project")
    settlement_items = relationship("SettlementItem", back_populates="project")


class GPSRecord(Base):
    __tablename__ = "gps_records"

    id = Column(Integer, primary_key=True, index=True)
    plot_id = Column(Integer, ForeignKey("plots.id"))
    project_id = Column(Integer, ForeignKey("projects.id"))
    gps_area = Column(Float, nullable=False)
    operation_date = Column(DateTime)
    device_id = Column(String(100))
    operator = Column(String(100))
    coordinates = Column(Text)
    batch_no = Column(String(100))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    plot = relationship("Plot", back_populates="gps_records")
    project = relationship("Project", back_populates="gps_records")
    settlement_items = relationship("SettlementItem", back_populates="gps_record")


class Confirmation(Base):
    __tablename__ = "confirmations"

    id = Column(Integer, primary_key=True, index=True)
    plot_id = Column(Integer, ForeignKey("plots.id"))
    farmer_id = Column(Integer, ForeignKey("farmers.id"))
    project_id = Column(Integer, ForeignKey("projects.id"))
    confirmed_area = Column(Float, nullable=False)
    confirmed_by = Column(String(100))
    confirmed_at = Column(DateTime(timezone=True), server_default=func.now())
    notes = Column(Text)
    signature_image = Column(Text)
    batch_no = Column(String(100))

    plot = relationship("Plot", back_populates="confirmations")
    farmer = relationship("Farmer", back_populates="confirmations")


class Settlement(Base):
    __tablename__ = "settlements"

    id = Column(Integer, primary_key=True, index=True)
    settlement_no = Column(String(50), unique=True, nullable=False)
    farmer_id = Column(Integer, ForeignKey("farmers.id"))
    status = Column(String(20), default=SettlementStatus.DRAFT)
    total_gps_area = Column(Float, default=0)
    total_confirmed_area = Column(Float, default=0)
    total_final_area = Column(Float, default=0)
    total_amount = Column(Float, default=0)
    processed_by = Column(String(100))
    processed_at = Column(DateTime(timezone=True))
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    farmer = relationship("Farmer", back_populates="settlements")
    items = relationship("SettlementItem", back_populates="settlement")
    exception_records = relationship("ExceptionRecord", back_populates="settlement")


class SettlementItem(Base):
    __tablename__ = "settlement_items"

    id = Column(Integer, primary_key=True, index=True)
    settlement_id = Column(Integer, ForeignKey("settlements.id"))
    plot_id = Column(Integer, ForeignKey("plots.id"))
    project_id = Column(Integer, ForeignKey("projects.id"))
    gps_record_id = Column(Integer, ForeignKey("gps_records.id"))
    gps_area = Column(Float, nullable=False)
    confirmed_area = Column(Float)
    final_area = Column(Float, nullable=False)
    unit_price = Column(Float, nullable=False)
    amount = Column(Float, nullable=False)
    is_duplicate = Column(Boolean, default=False)
    duplicate_with = Column(Integer)
    area_diff = Column(Float, default=0)
    area_diff_ratio = Column(Float, default=0)
    notes = Column(Text)

    settlement = relationship("Settlement", back_populates="items")
    plot = relationship("Plot", back_populates="settlement_items")
    project = relationship("Project", back_populates="settlement_items")
    gps_record = relationship("GPSRecord", back_populates="settlement_items")


class ExceptionRecord(Base):
    __tablename__ = "exception_records"

    id = Column(Integer, primary_key=True, index=True)
    settlement_id = Column(Integer, ForeignKey("settlements.id"))
    exception_type = Column(String(50), nullable=False)
    original_input = Column(Text, nullable=False)
    handled_by = Column(String(100))
    handling_result = Column(Text)
    handling_notes = Column(Text)
    status = Column(String(20), default="pending")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    handled_at = Column(DateTime(timezone=True))

    settlement = relationship("Settlement", back_populates="exception_records")

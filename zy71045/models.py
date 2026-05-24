from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class OakBarrel(Base):
    __tablename__ = "oak_barrels"

    id = Column(Integer, primary_key=True, index=True)
    barrel_code = Column(String, unique=True, index=True, nullable=False)
    location = Column(String, nullable=False)
    capacity = Column(Float, nullable=False)
    current_volume = Column(Float, default=0.0)
    status = Column(String, default="active")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    batch_records = relationship("BatchRecord", back_populates="barrel")
    topping_records = relationship("ToppingRecord", back_populates="barrel")


class WineBatch(Base):
    __tablename__ = "wine_batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_code = Column(String, unique=True, index=True, nullable=False)
    wine_type = Column(String, nullable=False)
    vintage = Column(Integer, nullable=False)
    initial_volume = Column(Float, nullable=False)
    remaining_volume = Column(Float, nullable=False)
    status = Column(String, default="aging")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    batch_records = relationship("BatchRecord", back_populates="batch")
    topping_records = relationship("ToppingRecord", back_populates="source_batch")


class BatchRecord(Base):
    __tablename__ = "batch_records"

    id = Column(Integer, primary_key=True, index=True)
    barrel_id = Column(Integer, ForeignKey("oak_barrels.id"), nullable=False)
    batch_id = Column(Integer, ForeignKey("wine_batches.id"), nullable=False)
    fill_date = Column(DateTime(timezone=True), nullable=False)
    initial_volume = Column(Float, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    barrel = relationship("OakBarrel", back_populates="batch_records")
    batch = relationship("WineBatch", back_populates="batch_records")


class ToppingRecord(Base):
    __tablename__ = "topping_records"

    id = Column(Integer, primary_key=True, index=True)
    record_code = Column(String, unique=True, index=True, nullable=False)
    barrel_id = Column(Integer, ForeignKey("oak_barrels.id"), nullable=False)
    source_batch_id = Column(Integer, ForeignKey("wine_batches.id"), nullable=False)
    evaporation_volume = Column(Float, nullable=False)
    topping_volume = Column(Float, nullable=False)
    topping_date = Column(DateTime(timezone=True), nullable=False)
    operator = Column(String, nullable=False)
    status = Column(String, default="pending")
    inspection_status = Column(String, default="pending")
    is_valid = Column(Boolean, default=True)
    version = Column(Integer, default=1)
    parent_id = Column(Integer, ForeignKey("topping_records.id"), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    barrel = relationship("OakBarrel", back_populates="topping_records")
    source_batch = relationship("WineBatch", back_populates="topping_records")
    inspection = relationship("InspectionResult", back_populates="topping_record", uselist=False)
    children = relationship("ToppingRecord", remote_side=[id])


class InspectionResult(Base):
    __tablename__ = "inspection_results"

    id = Column(Integer, primary_key=True, index=True)
    topping_record_id = Column(Integer, ForeignKey("topping_records.id"), nullable=False)
    inspector = Column(String, nullable=False)
    inspection_date = Column(DateTime(timezone=True), nullable=False)
    appearance = Column(String, nullable=False)
    aroma = Column(String, nullable=False)
    taste = Column(String, nullable=False)
    overall_score = Column(Float, nullable=False)
    passed = Column(Boolean, nullable=False)
    comments = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    topping_record = relationship("ToppingRecord", back_populates="inspection")


class CellarReport(Base):
    __tablename__ = "cellar_reports"

    id = Column(Integer, primary_key=True, index=True)
    report_code = Column(String, unique=True, index=True, nullable=False)
    report_type = Column(String, nullable=False)
    start_date = Column(DateTime(timezone=True), nullable=False)
    end_date = Column(DateTime(timezone=True), nullable=False)
    generated_by = Column(String, nullable=False)
    total_toppings = Column(Integer, default=0)
    total_evaporation = Column(Float, default=0.0)
    total_topping_volume = Column(Float, default=0.0)
    pass_rate = Column(Float, default=0.0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

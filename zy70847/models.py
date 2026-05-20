from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import datetime


class Batch(Base):
    __tablename__ = "batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_no = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    status = Column(String, default="created")
    created_at = Column(DateTime, default=datetime.datetime.now)
    processed_at = Column(DateTime, nullable=True)
    material_hash = Column(String, unique=True, index=True)
    report_path = Column(String, nullable=True)

    raw_materials = relationship("RawMaterial", back_populates="batch")
    process_records = relationship("ProcessRecord", back_populates="batch")


class RawMaterial(Base):
    __tablename__ = "raw_materials"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"))
    line_number = Column(Integer)
    sku_name = Column(String)
    sku_code = Column(String)
    quantity = Column(Integer)
    location_code = Column(String)
    location_name = Column(String)
    inventory_time = Column(DateTime)
    expiry_date = Column(DateTime, nullable=True)
    is_error = Column(Boolean, default=False)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.now)

    batch = relationship("Batch", back_populates="raw_materials")
    process_records = relationship("ProcessRecord", back_populates="raw_material")


class SkuAlias(Base):
    __tablename__ = "sku_aliases"

    id = Column(Integer, primary_key=True, index=True)
    canonical_sku = Column(String, index=True, nullable=False)
    alias_sku = Column(String, index=True, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.now)


class ProcessRecord(Base):
    __tablename__ = "process_records"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"))
    raw_material_id = Column(Integer, ForeignKey("raw_materials.id"))
    canonical_sku = Column(String)
    adjusted_quantity = Column(Integer)
    priority_score = Column(Float)
    inventory_time_diff = Column(Integer, nullable=True)
    status = Column(String)
    step = Column(String)
    message = Column(Text)
    created_at = Column(DateTime, default=datetime.datetime.now)

    batch = relationship("Batch", back_populates="process_records")
    raw_material = relationship("RawMaterial", back_populates="process_records")


class LocationInventoryTime(Base):
    __tablename__ = "location_inventory_times"

    id = Column(Integer, primary_key=True, index=True)
    location_code = Column(String, unique=True, index=True)
    standard_inventory_time = Column(DateTime)
    created_at = Column(DateTime, default=datetime.datetime.now)

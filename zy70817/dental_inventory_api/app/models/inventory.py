from sqlalchemy import Column, String, DateTime, Float, Integer, Boolean, Text
from datetime import datetime
from app.utils.database import Base

class Inventory(Base):
    __tablename__ = "inventory"

    id = Column(Integer, primary_key=True, index=True)
    batch_number = Column(String, index=True)
    material_name = Column(String, index=True)
    material_type = Column(String)
    spec = Column(String)
    quantity = Column(Float)
    unit = Column(String)
    production_date = Column(DateTime)
    expiry_date = Column(DateTime)
    supplier = Column(String)
    store_id = Column(String, index=True)
    store_name = Column(String)
    is_replacement = Column(Boolean, default=False)
    replaced_batch = Column(String, nullable=True)
    original_source = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_processed = Column(Boolean, default=False)
    process_status = Column(String, default="pending")

class InventoryProcessingRecord(Base):
    __tablename__ = "inventory_processing_records"

    id = Column(Integer, primary_key=True, index=True)
    batch_number = Column(String, index=True)
    material_name = Column(String)
    store_id = Column(String)
    process_date = Column(DateTime, default=datetime.utcnow)
    status = Column(String)
    original_data = Column(Text)
    suggestion = Column(Text)
    failure_reason = Column(String, nullable=True)

from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Text
from sqlalchemy.sql import func
from database import Base


class MaterialImport(Base):
    __tablename__ = "material_imports"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(String, index=True)
    repair_order_no = Column(String, index=True)
    material_code = Column(String)
    material_name = Column(String)
    quantity = Column(Float)
    unit = Column(String)
    vehicle_id = Column(String)
    operator = Column(String)
    operation_type = Column(String)
    import_time = Column(DateTime(timezone=True), server_default=func.now())
    status = Column(String)
    suggestion = Column(Text)
    raw_data = Column(Text)


class Inventory(Base):
    __tablename__ = "inventories"

    id = Column(Integer, primary_key=True, index=True)
    material_code = Column(String, unique=True, index=True)
    material_name = Column(String)
    quantity = Column(Float)
    unit = Column(String)
    warehouse = Column(String)
    last_updated = Column(DateTime(timezone=True), onupdate=func.now())


class Vehicle(Base):
    __tablename__ = "vehicles"

    id = Column(Integer, primary_key=True, index=True)
    vehicle_id = Column(String, unique=True, index=True)
    vehicle_plate = Column(String)
    driver = Column(String)
    team = Column(String)
    status = Column(String)


class ProcessedBatch(Base):
    __tablename__ = "processed_batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(String, unique=True, index=True)
    process_time = Column(DateTime(timezone=True), server_default=func.now())
    total_count = Column(Integer)
    success_count = Column(Integer)
    pending_count = Column(Integer)
    failed_count = Column(Integer)

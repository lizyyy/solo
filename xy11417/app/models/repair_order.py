from sqlalchemy import Column, Integer, String, DateTime, Text, JSON, ForeignKey, Boolean, Float
from sqlalchemy.sql import func
from app.core.database import Base

class RepairOrder(Base):
    __tablename__ = "repair_orders"
    
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(String(100), unique=True, index=True, nullable=False)
    resident_id = Column(String(50), index=True)
    resident_name = Column(String(100))
    room_number = Column(String(50))
    repair_type = Column(String(100))
    original_repair_content = Column(Text)
    first_repair_time = Column(DateTime)
    technician_id = Column(String(50))
    technician_name = Column(String(100))
    is_repair_needed = Column(Boolean, default=False)
    is_part_replacement = Column(Boolean, default=False)
    total_material_cost = Column(Float, default=0.0)
    total_labor_cost = Column(Float, default=0.0)
    total_compensation = Column(Float, default=0.0)
    status = Column(String(50), default="active")
    complaint_filed = Column(Boolean, default=False)
    complaint_id = Column(String(100))
    merged_source_ids = Column(JSON)
    related_task_ids = Column(JSON)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class OrderMergeHistory(Base):
    __tablename__ = "order_merge_history"
    
    id = Column(Integer, primary_key=True, index=True)
    merge_id = Column(String(100), unique=True, index=True, nullable=False)
    target_order_id = Column(String(100), ForeignKey("repair_orders.order_id"), nullable=False)
    source_order_id = Column(String(100))
    source_type = Column(String(50))
    source_data_id = Column(Integer)
    merge_reason = Column(String(200))
    merge_type = Column(String(50))
    merged_by = Column(Integer, ForeignKey("users.id"))
    merged_at = Column(DateTime(timezone=True), server_default=func.now())
    details_before = Column(JSON)
    details_after = Column(JSON)
